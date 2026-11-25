# Isolated local inference

Python 3.12 is the verified worker runtime. The system Python on this Mac is 3.9 and is not the supported inference environment.

```sh
uv venv --python 3.12 workers/.venv
uv pip install --python workers/.venv/bin/python -r workers/requirements.txt
cp workers/config.example.json workers/config.local.json
```

Edit `config.local.json` with existing **absolute** local paths. It is ignored by Git. No models or executables download automatically. `sd-cli` from stable-diffusion.cpp, the FLUX.2 Klein 4B GGUF, Qwen3-4B GGUF text encoder and FLUX.2 VAE are all needed. On Windows use `workers\.venv\Scripts\python.exe` and JSON-escaped paths.

```sh
workers/.venv/bin/python workers/worker.py health < /dev/null
workers/.venv/bin/python -m unittest discover -s workers/tests
workers/.venv/bin/python workers/smoke.py
workers/.venv/bin/python workers/smoke.py --reference workers/artifacts/flux-klein-smoke.png
```

The smoke test executes the real configured model and writes a PNG, diagnostic log and receipt under ignored `workers/artifacts/`. It is deliberately separate from the fast test suite. A health check confirms configured files, not successful inference.

For a packaged app, set `JAVLOGOS_PYTHON` to the isolated environment interpreter and `JAVLOGOS_WORKER_CONFIG` to an absolute JSON config outside the app bundle. Do not modify resources inside a signed bundle. Environment overrides use `JAVLOGOS_` plus uppercase keys, e.g. `JAVLOGOS_PROVIDER=sdcpp`. Runtime distribution and platform-specific installer provisioning are release gates.

## Provider adapters

- **sdcpp:** verified locally on macOS Apple Silicon, existing Metal-enabled binary commit `95b3090`; supports text generation and one reference image. One `--batch-count` process loads the models once and produces ordered images using seed + index. Requires the runtime's numbered output and batch-count options (verified via its actual `--help`). CPU/CUDA/Vulkan runtime binaries must be independently provisioned and tested on other platforms.
- **diffusers:** optional `requirements-diffusers.txt`, complete local snapshot at `JAVLOGOS_DIFFUSERS_MODEL`; no implicit downloads (`local_files_only=True`). Uses `Flux2KleinPipeline`, four steps, guidance 1; device chooses CUDA, MPS, then CPU. Adapter exists but no inference acceptance has been run. GGUF split files are **not** a complete Diffusers snapshot.
- **comfyui:** explicit local server only (`JAVLOGOS_COMFY_URL`, default `http://127.0.0.1:8188`), and API-format workflow JSON at `JAVLOGOS_COMFY_WORKFLOW`. Replace whole input values with `"{{prompt}}"`, `"{{seed}}"`, `"{{width}}"`, `"{{height}}"`; optional `"{{reference}}"` receives an uploaded reference filename. Numeric placeholders become numeric JSON values. Template nodes and installed model filenames must be compatible with the user's server. Redirects/proxies are disabled. This adapter has no live-server acceptance yet.

ComfyUI cancellation always deletes only this queued prompt. Set `JAVLOGOS_COMFY_TARGETED_INTERRUPT=true` **only** after confirming the installed server's `/interrupt` accepts `prompt_id` (current upstream does). Older servers may ignore the field and interrupt other users, so targeted interrupt is disabled by default. Without that flag an already-running server job may finish after the JavLogos worker stops; this limitation is explicit.

## Protocol and safety

`worker.py health|generate|vectorize` reads one bounded JSON object from stdin, emits one JSON value to stdout, and sends diagnostics to stderr. Failure is `{ "error": { "code": "...", "message": "..." } }` with exit 1. Missing provider health is an ordinary `{available:false,...}` response. No shell interpolation or renderer-selected executables.

Generation accepts counts 1–4, dimensions 256–1024 in multiples of 64, a bounded prompt, seed and optional base64 PNG/JPEG/WebP. References are decoded, dimensions checked, and re-encoded as raster. VTracer downsizes input above 1024px, returns SVG paths, and enforces a 4 MiB output bound. UI must independently sanitize resulting SVG before use.

SIGTERM unwinds worker adapters and terminates/reaps the owned sd-cli process. Native authority owns process-group termination, timeouts and cancellation races; those tests are separate from the Python child-cleanup test. No retry or replay of interrupted generation occurs automatically.

## Observable generation

Stderr may contain `JAVLOGOS_EVENT ` followed by a JSON object with phase, message, imageIndex/imageCount, optional real step/steps, and an optional completed-image thumbnail. Native code drains stderr continuously, distinguishes model tensor counters from diffusion steps, strips terminal escape sequences/local paths, bounds the 80-line log ring and keeps the latest owned job snapshot for `generation_progress`. Long log streams no longer fail merely for exceeding the old 64 KiB total. Individual oversized lines are discarded; stdout remains bounded final JSON.

No diffusion preview is fabricated. The sd-cli batch currently writes final images after decoding, so thumbnails appear when those outputs exist. Native parsing exposes the actual image/step lines during sampling. ComfyUI's HTTP history adapter reports submission/waiting and completed output; it does not claim node/step progress without a live event channel. Diffusers has a step-end callback but remains unverified against a complete local snapshot.

Executed 2026-11-25 on M5: real two-image 256 px batch completed in 26.352 seconds, seeds 42/43, distinct PNGs. Only one diffusion-model load appeared in its log. Receipt, raw log and images are in ignored `workers/artifacts/observable-batch/`. This is one smoke observation, not a statistical benchmark. No active sd-cli process was present when investigating the reported freeze, so no deadlock reproduction is claimed; opaque status and per-image model reloads were confirmed from source.
