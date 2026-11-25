"""Optional Diffusers adapter; local_files_only prevents implicit model downloads."""
from __future__ import annotations

import importlib.util
from pathlib import Path

from common import WorkerError, decode_image, encode_png


class DiffusersProvider:
    name = "FLUX.2 Klein 4B · Diffusers"

    def __init__(self, values: dict[str, str]):
        self.values = values

    def health(self) -> str:
        if not all(importlib.util.find_spec(name) for name in ["torch", "diffusers", "transformers"]):
            raise WorkerError("Install the optional Diffusers dependencies in the isolated worker environment.", "UNAVAILABLE")
        root = Path(self.values.get("diffusers_model", "")).expanduser()
        if not (root / "model_index.json").is_file():
            raise WorkerError("Configure JAVLOGOS_DIFFUSERS_MODEL to a complete local FLUX.2 Klein snapshot.", "UNAVAILABLE")
        return "Local Diffusers snapshot found; device compatibility is checked during generation."

    def generate(self, request: dict) -> dict:
        self.health()
        import torch
        from diffusers import Flux2KleinPipeline
        device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        dtype = torch.bfloat16 if device in {"cuda", "mps"} else torch.float32
        pipe = Flux2KleinPipeline.from_pretrained(self.values["diffusers_model"], torch_dtype=dtype, local_files_only=True)
        if device == "cuda":
            pipe.enable_model_cpu_offload()
        else:
            pipe.to(device)
        pipe.enable_attention_slicing()
        reference = decode_image(request["referenceBase64"]) if request.get("referenceBase64") else None
        images = []
        for index in range(request["count"]):
            seed = request["seed"] + index
            options = {"prompt": request["prompt"], "width": request["width"], "height": request["height"],
                       "num_inference_steps": 4, "guidance_scale": 1.0,
                       "generator": torch.Generator(device="cpu").manual_seed(seed)}
            if reference is not None:
                options["image"] = reference
            image = pipe(**options).images[0]
            images.append({"pngBase64": encode_png(image), "seed": seed})
        return {"images": images, "provider": self.name}
