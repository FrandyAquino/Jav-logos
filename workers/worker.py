#!/usr/bin/env python3
"""One command per isolated process; stdout contains exactly one JSON response."""
from __future__ import annotations

from contextlib import redirect_stdout
import json
import signal
import sys
import tempfile
from pathlib import Path

from common import MAX_INPUT_BYTES, WorkerError, config, decode_image, validate_generation


def provider():
    values = config()
    name = values.get("provider", "sdcpp")
    if name == "sdcpp":
        from sdcpp import SdCppProvider
        return SdCppProvider(values)
    if name == "comfyui":
        from comfyui_adapter import ComfyUiProvider
        return ComfyUiProvider(values)
    if name == "diffusers":
        from diffusers_adapter import DiffusersProvider
        return DiffusersProvider(values)
    raise WorkerError("Select sdcpp, comfyui or diffusers as JAVLOGOS_PROVIDER.", "CONFIGURATION")


def run_command(command: str, request: dict):
    if command == "health":
        try:
            adapter = provider()
            return {"available": True, "provider": adapter.name, "message": adapter.health()}
        except WorkerError as error:
            return {"available": False, "provider": "Local image generation", "message": str(error)}
    if command == "generate":
        validate_generation(request)
        return provider().generate(request)
    if command == "vectorize":
        try:
            import vtracer
        except ImportError as error:
            raise WorkerError("Install workers/requirements.txt to enable VTracer.", "UNAVAILABLE") from error
        image = decode_image(request.get("pngBase64"))
        if image.width > 1024 or image.height > 1024:
            image.thumbnail((1024, 1024))
        with tempfile.TemporaryDirectory(prefix="javlogos-trace-") as directory:
            raster = Path(directory) / "input.png"
            output = Path(directory) / "output.svg"
            image.save(raster)
            vtracer.convert_image_to_svg_py(str(raster), str(output), colormode="color", hierarchical="stacked",
                                           mode="spline", filter_speckle=8, color_precision=4, layer_difference=24)
            if output.stat().st_size > 4 * 1024 * 1024:
                raise WorkerError("Vector result exceeds 4 MiB; use a simpler source image.", "OUTPUT_LIMIT")
            return output.read_text()
    raise WorkerError("Unknown worker command.")


def terminate(_signum, _frame):
    # SystemExit unwinds adapter finally blocks, terminating owned child processes.
    raise SystemExit(143)


def main() -> int:
    signal.signal(signal.SIGTERM, terminate)
    try:
        if len(sys.argv) != 2:
            raise WorkerError("Expected one command: health, generate or vectorize.")
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise WorkerError("Worker request exceeds 18 MiB.")
        request = json.loads(raw or b"{}")
        if not isinstance(request, dict):
            raise WorkerError("Request must be a JSON object.")
        with redirect_stdout(sys.stderr):
            result = run_command(sys.argv[1], request)
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except (WorkerError, json.JSONDecodeError) as error:
        print(json.dumps({"error": {"code": getattr(error, "code", "INVALID_INPUT"), "message": str(error)}}))
        return 1
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        print(json.dumps({"error": {"code": "WORKER_FAILED", "message": "Local worker failed. Check runtime configuration and diagnostics."}}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
