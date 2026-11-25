"""Bounded worker inputs and local configuration; no renderer-supplied executable paths."""
from __future__ import annotations

import base64
import binascii
import io
import json
import os
from pathlib import Path

MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_INPUT_BYTES = 18 * 1024 * 1024


class WorkerError(Exception):
    def __init__(self, message: str, code: str = "INVALID_INPUT"):
        super().__init__(message)
        self.code = code


def config() -> dict[str, str]:
    path = Path(os.environ.get("JAVLOGOS_WORKER_CONFIG", Path(__file__).with_name("config.local.json")))
    try:
        if path.is_file() and path.stat().st_size > 65536:
            raise WorkerError("Worker configuration exceeds 64 KiB.", "CONFIGURATION")
        values = json.loads(path.read_text()) if path.is_file() else {}
    except (OSError, json.JSONDecodeError) as error:
        raise WorkerError("Worker configuration is unreadable or invalid JSON.", "CONFIGURATION") from error
    if not isinstance(values, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in values.items()):
        raise WorkerError("Worker configuration must contain string keys and values.", "CONFIGURATION")
    for key, value in os.environ.items():
        if key.startswith("JAVLOGOS_"):
            values[key.removeprefix("JAVLOGOS_").lower()] = value
    return values


def validate_generation(request: dict) -> dict:
    if not isinstance(request, dict):
        raise WorkerError("Generation input must be an object.")
    prompt = request.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 6000:
        raise WorkerError("Prompt must contain 1–6000 characters.")
    job_id = request.get("jobId")
    if not isinstance(job_id, str) or not 1 <= len(job_id) <= 128:
        raise WorkerError("A job identifier is required.")
    for field, minimum, maximum in [("count", 1, 4), ("width", 256, 1024), ("height", 256, 1024), ("seed", 0, 2**32 - 5)]:
        value = request.get(field)
        if type(value) is not int or not minimum <= value <= maximum:
            raise WorkerError(f"{field} must be an integer between {minimum} and {maximum}.")
    if request["width"] % 64 or request["height"] % 64:
        raise WorkerError("Image dimensions must be multiples of 64.")
    if request.get("referenceBase64"):
        decode_image(request["referenceBase64"])
    return request


def decode_image(encoded: str):
    from PIL import Image, UnidentifiedImageError
    if not isinstance(encoded, str) or len(encoded) > MAX_IMAGE_BYTES * 4 // 3 + 4:
        raise WorkerError("Image exceeds the 12 MiB limit.")
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > MAX_IMAGE_BYTES:
            raise WorkerError("Image exceeds the 12 MiB limit.")
        image = Image.open(io.BytesIO(raw))
        if image.format not in {"PNG", "JPEG", "WEBP"}:
            raise WorkerError("Use a PNG, JPEG or WebP reference.")
        if image.width > 4096 or image.height > 4096 or image.width * image.height > 16_777_216:
            raise WorkerError("Image dimensions exceed 4096 pixels.")
        image.load()
        return image.convert("RGB")
    except (binascii.Error, ValueError, UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise WorkerError("Image is not a valid supported raster.") from error


def encode_png(image) -> str:
    output = io.BytesIO()
    image.save(output, format="PNG")
    if output.tell() > MAX_IMAGE_BYTES:
        raise WorkerError("Generated image exceeds the output limit.", "OUTPUT_LIMIT")
    return base64.b64encode(output.getvalue()).decode("ascii")


def require_file(values: dict[str, str], key: str) -> Path:
    path = Path(values.get(key, "")).expanduser()
    if not path.is_file():
        raise WorkerError(f"Configure JAVLOGOS_{key.upper()} to an existing local file.", "UNAVAILABLE")
    return path.resolve()
