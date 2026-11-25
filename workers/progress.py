"""Optional bounded stderr events; stdout remains the final result protocol."""
from __future__ import annotations

import base64
import io
import json
import sys


def emit(phase: str, message: str, **fields) -> None:
    event = {"phase": phase, "message": message[:500], **fields}
    sys.stderr.write("JAVLOGOS_EVENT " + json.dumps(event, separators=(",", ":")) + "\n")
    sys.stderr.flush()


def image_ready(image, index: int, count: int) -> None:
    preview = image.copy().convert("RGB")
    preview.thumbnail((256, 256))
    output = io.BytesIO()
    preview.save(output, format="PNG")
    encoded = base64.b64encode(output.getvalue()).decode("ascii")
    if len(encoded) > 256 * 1024:
        preview.thumbnail((192, 192))
        output = io.BytesIO()
        preview.save(output, format="PNG")
        encoded = base64.b64encode(output.getvalue()).decode("ascii")
    emit("image-ready", f"Image {index} of {count} is ready", imageIndex=index,
         imageCount=count, previewBase64=encoded)
