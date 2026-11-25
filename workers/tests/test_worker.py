import base64
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from worker import WorkerError, decode_image, run_command, validate_generation


class WorkerTests(unittest.TestCase):
    def request(self, **changes):
        return dict(jobId="test-job", prompt="A geometric logo", seed=42,
                    count=1, width=256, height=256, **changes)

    def test_rejects_invalid_dimensions_and_booleans(self):
        for field, value in [("count", 0), ("width", 257), ("height", 2048), ("seed", True)]:
            request = self.request()
            request[field] = value
            with self.subTest(field=field), self.assertRaises(WorkerError):
                validate_generation(request)

    def test_rejects_empty_prompt(self):
        request = self.request()
        request["prompt"] = "  "
        with self.assertRaises(WorkerError):
            validate_generation(request)

    def test_rejects_invalid_reference(self):
        with self.assertRaises(WorkerError):
            decode_image("<svg onload='alert(1)'></svg>")

    def test_unavailable_provider_health_is_explicit(self):
        with patch.dict(os.environ, {"JAVLOGOS_PROVIDER": "sdcpp", "JAVLOGOS_SD_CLI": "/no/such/binary"}):
            result = run_command("health", {})
        self.assertFalse(result["available"])
        self.assertIn("JAVLOGOS_SD_CLI", result["message"])

    def test_vectorization_returns_actual_paths(self):
        image = Image.new("RGB", (32, 32), "white")
        for x in range(8, 24):
            for y in range(8, 24):
                image.putpixel((x, y), (10, 50, 100))
        output = io.BytesIO()
        image.save(output, format="PNG")
        result = run_command("vectorize", {"pngBase64": base64.b64encode(output.getvalue()).decode()})
        self.assertIn("<svg", result)
        self.assertIn("<path", result)
        self.assertNotIn("<script", result)

    def test_cli_rejects_payload_with_structured_error(self):
        process = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "worker.py"), "generate"],
                                 input='{"prompt": ""}', capture_output=True, text=True)
        self.assertEqual(process.returncode, 1)
        self.assertEqual(json.loads(process.stdout)["error"]["code"], "INVALID_INPUT")

    def test_comfyui_rejects_remote_urls(self):
        from comfyui_adapter import ComfyUiProvider
        for endpoint in ["https://example.com", "http://192.168.1.1:8188", "http://user@localhost:8188"]:
            with self.subTest(endpoint=endpoint), self.assertRaises(WorkerError):
                ComfyUiProvider({"comfy_url": endpoint})

    def test_comfyui_cleanup_attempts_targeted_interrupt_even_if_queue_delete_fails(self):
        from comfyui_adapter import ComfyUiProvider
        with tempfile.TemporaryDirectory() as temporary:
            workflow=Path(temporary)/"workflow.json"
            workflow.write_text(json.dumps({"inputs":["{{prompt}}","{{seed}}","{{width}}","{{height}}"]}))
            provider=ComfyUiProvider({"comfy_workflow":str(workflow),"comfy_targeted_interrupt":"true"})
            calls=[]
            def request(path,payload=None,**kwargs):
                calls.append((path,payload,kwargs))
                if path=="/prompt":return {"prompt_id":"owned-prompt"}
                if path.startswith("/history/"):raise WorkerError("Stopped")
                if path=="/queue":raise WorkerError("Queue timeout")
                return {}
            with patch.object(provider,"request",side_effect=request),self.assertRaises(WorkerError):
                provider.generate(self.request())
            self.assertEqual(calls[-1],("/interrupt",{"prompt_id":"owned-prompt"},{"timeout":2}))
            self.assertEqual(calls[-2][2],{"timeout":2})

    @unittest.skipIf(os.name == "nt", "POSIX process termination evidence")
    def test_termination_reaps_owned_inference_child(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            binary = directory / "fake-inference"
            marker = directory / "child.pid"
            binary.write_text("#!/usr/bin/env python3\nimport os,time\nfrom pathlib import Path\nPath(os.environ['JAVLOGOS_TEST_CHILD_PID']).write_text(str(os.getpid()))\ntime.sleep(30)\n")
            binary.chmod(0o700)
            model = directory / "model"
            model.touch()
            environment = dict(os.environ, JAVLOGOS_PROVIDER="sdcpp", JAVLOGOS_SD_CLI=str(binary),
                               JAVLOGOS_FLUX_MODEL=str(model), JAVLOGOS_TEXT_ENCODER=str(model),
                               JAVLOGOS_VAE=str(model), JAVLOGOS_TEST_CHILD_PID=str(marker))
            worker = subprocess.Popen([sys.executable, str(Path(__file__).resolve().parents[1] / "worker.py"), "generate"],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment)
            try:
                worker.stdin.write(json.dumps(self.request()).encode())
                worker.stdin.close()
                deadline = time.monotonic() + 5
                while not marker.exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue(marker.exists(), "Inference child did not start")
                child_pid = int(marker.read_text())
                worker.terminate()
                worker.wait(timeout=5)
                with self.assertRaises(ProcessLookupError):
                    os.kill(child_pid, 0)
            finally:
                if worker.poll() is None:
                    worker.kill()
                    worker.wait()
                worker.stdout.close()
                worker.stderr.close()


if __name__ == "__main__":
    unittest.main()
