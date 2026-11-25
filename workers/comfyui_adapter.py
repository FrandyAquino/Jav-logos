"""Local ComfyUI API adapter using an explicit user-installed API workflow template."""
from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

from common import MAX_IMAGE_BYTES, WorkerError, decode_image, encode_png, require_file


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise WorkerError("ComfyUI redirects are disabled to keep requests local.", "PROVIDER_ERROR")


class ComfyUiProvider:
    name = "FLUX.2 Klein 4B · ComfyUI"

    def __init__(self, values: dict[str, str]):
        self.values = values
        self.url = values.get("comfy_url", "http://127.0.0.1:8188").rstrip("/")
        parsed = urllib.parse.urlparse(self.url)
        if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"} or parsed.username or parsed.password or parsed.path:
            raise WorkerError("ComfyUI must use a loopback HTTP endpoint without credentials or a path.", "CONFIGURATION")
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, path: str, payload: dict | None = None, *, raw: bool = False, timeout: float = 10):
        data = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(self.url + path, data=data, headers={"Content-Type": "application/json"})
        try:
            with self.opener.open(request, timeout=timeout) as response:
                content = response.read(MAX_IMAGE_BYTES + 1)
            if len(content) > MAX_IMAGE_BYTES:
                raise WorkerError("ComfyUI response exceeds output limit.", "OUTPUT_LIMIT")
            return content if raw else json.loads(content)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            raise WorkerError(f"Local ComfyUI request failed: {error}", "PROVIDER_ERROR") from error

    def health(self) -> str:
        require_file(self.values, "comfy_workflow")
        self.request("/system_stats")
        return "Local ComfyUI is reachable; configured API workflow executes on generation."

    def upload_reference(self, encoded: str) -> str:
        content = base64.b64decode(encode_png(decode_image(encoded)))
        filename = f"javlogos-{uuid.uuid4()}.png"
        boundary = uuid.uuid4().hex
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{filename}"\r\nContent-Type: image/png\r\n\r\n'.encode()
                + content + f"\r\n--{boundary}--\r\n".encode())
        request = urllib.request.Request(self.url + "/upload/image", data=body,
                                        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        with self.opener.open(request, timeout=15) as response:
            result = json.loads(response.read(8192))
        return result["name"]

    def generate(self, request: dict) -> dict:
        workflow_path = require_file(self.values, "comfy_workflow")
        if workflow_path.stat().st_size > 1024 * 1024:
            raise WorkerError("ComfyUI workflow exceeds 1 MiB.", "CONFIGURATION")
        template = json.loads(workflow_path.read_text())
        if not isinstance(template, dict) or any(token not in json.dumps(template) for token in ["{{prompt}}", "{{seed}}", "{{width}}", "{{height}}"]):
            raise WorkerError("ComfyUI API workflow must include prompt, seed, width and height placeholders.", "CONFIGURATION")
        reference = ""
        if request.get("referenceBase64"):
            if "{{reference}}" not in json.dumps(template):
                raise WorkerError("This ComfyUI workflow does not accept reference images.", "UNSUPPORTED")
            reference = self.upload_reference(request["referenceBase64"])
        images = []
        for index in range(request["count"]):
            replacements = {"{{prompt}}": request["prompt"], "{{seed}}": request["seed"] + index,
                            "{{width}}": request["width"], "{{height}}": request["height"], "{{reference}}": reference}

            def replace(value):
                if isinstance(value, dict):
                    return {key: replace(item) for key, item in value.items()}
                if isinstance(value, list):
                    return [replace(item) for item in value]
                return replacements.get(value, value) if isinstance(value, str) else value

            result = self.request("/prompt", {"prompt": replace(template), "client_id": request["jobId"]})
            prompt_id = result.get("prompt_id")
            if not isinstance(prompt_id, str):
                raise WorkerError("ComfyUI rejected the workflow; verify model nodes and filenames.", "WORKFLOW_INVALID")
            completed = False
            try:
                deadline = time.monotonic() + 840
                while time.monotonic() < deadline:
                    history = self.request("/history/" + urllib.parse.quote(prompt_id, safe=""))
                    item = history.get(prompt_id)
                    if item:
                        if item.get("status", {}).get("status_str") == "error":
                            raise WorkerError("ComfyUI workflow failed; inspect its execution log.", "INFERENCE_FAILED")
                        outputs = [image for output in item.get("outputs", {}).values() for image in output.get("images", [])]
                        if not outputs:
                            raise WorkerError("ComfyUI workflow returned no image output.", "INFERENCE_FAILED")
                        query = urllib.parse.urlencode({key: outputs[0][key] for key in ["filename", "subfolder", "type"] if key in outputs[0]})
                        data = self.request("/view?" + query, raw=True)
                        images.append({"pngBase64": encode_png(decode_image(base64.b64encode(data).decode())), "seed": request["seed"] + index})
                        completed = True
                        break
                    time.sleep(0.5)
                if not completed:
                    raise WorkerError("ComfyUI generation timed out.", "TIMEOUT")
            finally:
                if not completed:
                    # Targeted interrupt is opt-in: old ComfyUI versions ignore prompt_id.
                    try:
                        self.request("/queue", {"delete": [prompt_id]}, timeout=2)
                    except WorkerError:
                        pass
                    if self.values.get("comfy_targeted_interrupt") == "true":
                        try:
                            self.request("/interrupt", {"prompt_id": prompt_id}, timeout=2)
                        except WorkerError:
                            pass
        return {"images": images, "provider": self.name}
