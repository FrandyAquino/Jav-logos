"""Reproducible real-provider smoke test. Writes PNG and receipt under ignored artifacts/."""
import base64
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    output = root / "artifacts" / ("reference" if args.reference else ".")
    output.mkdir(exist_ok=True, parents=True)
    request = {"jobId": "javlogos-flux-smoke", "prompt": "Minimal geometric logo mark, two interlocking blue circular arcs forming a letter J, flat vector style, dark navy and cobalt blue on pure white background, centered composition, no text, no shadows, no gradients", "seed": 42, "count": 1, "width": 256, "height": 256}
    if args.reference:
        request["referenceBase64"] = base64.b64encode(args.reference.read_bytes()).decode()
        request["prompt"] = "Keep the same geometric J logo composition as the reference image, change the cobalt blue area to orange, retain the dark navy lower part, flat vector logo on white background."
    started = time.monotonic()
    with (output / "inference.log").open("w") as log:
        result = subprocess.run([sys.executable, str(root / "worker.py"), "generate"], input=json.dumps(request),
                                text=True, stdout=subprocess.PIPE, stderr=log, timeout=960)
    elapsed = time.monotonic() - started
    response = json.loads(result.stdout)
    receipt = {"request": {key: value for key, value in request.items() if key != "referenceBase64"}, "reference": str(args.reference) if args.reference else None, "elapsedSeconds": round(elapsed, 3), "exitCode": result.returncode}
    if result.returncode:
        receipt["error"] = response
    else:
        from PIL import Image
        data = base64.b64decode(response["images"][0]["pngBase64"], validate=True)
        image_path = output / "flux-klein-smoke.png"
        image_path.write_bytes(data)
        with Image.open(image_path) as image:
            image.verify()
        receipt.update(provider=response["provider"], sha256=hashlib.sha256(data).hexdigest(), bytes=len(data), image=str(image_path))
    (output / "smoke-receipt.json").write_text(json.dumps(receipt, indent=2))
    print(json.dumps(receipt, indent=2))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
