"""FLUX.2 Klein GGUF adapter; one model load and one owned process per batch."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import tempfile

from common import WorkerError, decode_image, encode_png, require_file
from progress import emit, image_ready


class SdCppProvider:
    name = "FLUX.2 Klein 4B · stable-diffusion.cpp"

    def __init__(self, values: dict[str, str]):
        self.values = values

    def files(self) -> dict[str, Path]:
        files = {key: require_file(self.values, key) for key in ["sd_cli", "flux_model", "text_encoder", "vae"]}
        if not os.access(files["sd_cli"], os.X_OK):
            raise WorkerError("Configured sd-cli is not executable.", "UNAVAILABLE")
        return files

    def health(self) -> str:
        self.files()
        return "Local GGUF runtime and model files found. Each batch loads model weights once."

    def generate(self, request: dict) -> dict:
        from PIL import Image
        files = self.files()
        images = []
        with tempfile.TemporaryDirectory(prefix="javlogos-") as directory:
            root = Path(directory)
            reference = None
            if request.get("referenceBase64"):
                reference = root / "reference.png"
                decode_image(request["referenceBase64"]).save(reference)
            args = [str(files["sd_cli"]), "--diffusion-model", str(files["flux_model"]),
                    "--llm", str(files["text_encoder"]), "--vae", str(files["vae"]),
                    "--prompt", request["prompt"], "--output", str(root / "concept-%d.png"),
                    "--output-begin-idx", "0", "--batch-count", str(request["count"]),
                    "--width", str(request["width"]), "--height", str(request["height"]),
                    "--steps", "4", "--cfg-scale", "1", "--guidance", "1",
                    "--sampling-method", "euler", "--seed", str(request["seed"]), "--vae-tiling"]
            if reference:
                args.extend(["--ref-image", str(reference)])
            emit("loading", "Loading FLUX, text encoder and VAE once for this batch",
                 imageIndex=1, imageCount=request["count"])
            process = subprocess.Popen(args, stdout=sys.stderr, stderr=sys.stderr)
            try:
                return_code = process.wait(timeout=900)
                if return_code != 0:
                    raise WorkerError(f"Local inference exited with code {return_code}; inspect worker diagnostics.", "INFERENCE_FAILED")
            except subprocess.TimeoutExpired as error:
                raise WorkerError("Local inference exceeded 15 minutes.", "TIMEOUT") from error
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
            for index in range(request["count"]):
                output = root / f"concept-{index}.png"
                if not output.is_file() or output.stat().st_size > 12 * 1024 * 1024:
                    raise WorkerError("Inference did not produce the complete bounded PNG batch.", "INFERENCE_FAILED")
                with Image.open(output) as image:
                    if image.size != (request["width"], request["height"]):
                        raise WorkerError("Inference returned unexpected image dimensions.", "INFERENCE_FAILED")
                    image = image.convert("RGB")
                    images.append({"pngBase64": encode_png(image), "seed": request["seed"] + index})
                    image_ready(image, index + 1, request["count"])
        return {"images": images, "provider": self.name}
