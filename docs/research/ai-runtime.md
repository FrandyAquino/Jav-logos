# AI runtime research and executed evidence

Verified 2026-11-25 on macOS 27.0.1, Apple M5, 24 GB unified memory. These are single smoke runs, not statistical benchmarks or cross-platform acceptance.

## Compatibility decision

The downloaded model consists of split GGUF files plus a safetensors VAE. A compatible existing `stable-diffusion.cpp` Metal runtime was found, commit `95b3090`. Use its adapter for the functional local path. Keep ComfyUI and Diffusers as interchangeable optional adapters, without downloading another model copy or requiring a server subscription.

Artifacts found in Hugging Face cache:

| Repository | Revision | File |
|---|---|---|
| leejet/FLUX.2-klein-4B-GGUF | `3b1f5a9dc3abb32238b053aeb3d823c30afdacbd` | `flux-2-klein-4b-Q8_0.gguf` |
| unsloth/Qwen3-4B-GGUF | `22c9fc8a8c7700b76a1789366280a6a5a1ad1120` | `Qwen3-4B-Q8_0.gguf` |
| Comfy-Org/Flux-2-Klein-4B | `533c4cbc3d3b89af1743d9466c434e89810391c0` | `split_files/vae/flux2-vae.safetensors` |

All three were loaded successfully by the actual inference process. Their cache revision names were inspected; a fresh full weight hash audit was not run. No weights downloaded or committed.

## Actual smoke results

`workers/.venv/bin/python workers/smoke.py`: 256×256 image, seed 42, 4 Euler steps, guidance/CFG 1, exited 0 in **20.216 seconds** including model loading. Output PNG 21,069 bytes; SHA-256 `fc1ce387566f424f2a8de60a0b94afd4931bbcda031c18efcf87a1c93f27604c`. Visually inspected a blue/navy J mark on white. Log confirms Metal backend. This proves image inference, not trademark originality or brand quality.

`workers/.venv/bin/python workers/smoke.py --reference workers/artifacts/flux-klein-smoke.png`: reference refinement exited 0 in **24.158 seconds**. Output PNG 19,873 bytes; SHA-256 `6fc30f1c3b0a667dbf277f47f75ca457fdf69681c9403ca208bff4106c2b5529`. Visually inspected: original J composition retained, blue region changed to orange as requested.

Real generated PNG → `worker.py vectorize`: VTracer returned **4 SVG paths**, 6,447 bytes in **0.044 seconds**. The original raster and trace are in ignored `workers/artifacts/`. Exporting traces does not imply editable semantic geometry or original Bézier construction.

Eight Python tests pass: generation bounds, empty prompt, invalid raster, unavailable provider, actual VTracer path output, structured CLI error, remote ComfyUI endpoint rejection, and SIGTERM termination/reaping of an owned test inference child. Initial test run failed because `worker` did not exist; implementation then passed with an error-message assertion corrected to the documented config variable. Tests are not native desktop acceptance.

## Official sources and licenses

Read directly during implementation:

- [BFL FLUX.2 Klein 4B model card](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B): Apache-2.0, `Flux2KleinPipeline`, four steps and guidance 1, image/reference support. Its advertised latency is not this machine's measured latency.
- [Qwen3 GGUF model card](https://huggingface.co/unsloth/Qwen3-4B-GGUF): Apache-2.0 with Qwen/Qwen3-4B base attribution.
- [stable-diffusion.cpp license](https://github.com/leejet/stable-diffusion.cpp/blob/master/LICENSE): MIT. The local binary's `--help` verified actual model, text encoder, reference, CFG, steps and output flags; documentation paths `docs/flux.md` and `docs/flux2.md` returned 404 and were not treated as sources.
- [Diffusers Klein implementation](https://github.com/huggingface/diffusers/blob/main/src/diffusers/pipelines/flux2/pipeline_flux2_klein.py) and [license](https://github.com/huggingface/diffusers/blob/main/LICENSE): Apache-2.0. Optional dependency versions were verified on PyPI, but no complete local snapshot exists and the optional combination was not installed/inference-tested.
- [ComfyUI server routes](https://github.com/comfyanonymous/ComfyUI/blob/master/server.py): current `/interrupt` accepts `prompt_id`; older versions require special caution. [License](https://github.com/comfyanonymous/ComfyUI/blob/master/LICENSE): GPL-3.0; server is optional and is not redistributed here.
- [VTracer](https://github.com/visioncortex/vtracer) and [license](https://github.com/visioncortex/vtracer/blob/master/LICENSE): MIT; installed Python package `vtracer==0.6.12` metadata confirms MIT. `Pillow==12.2.0` metadata declares MIT-CMU.

## Remaining release gates

Windows/Linux runtime and GPU behavior, packaged Python provisioning, optional live ComfyUI/Diffusers inference, full batch memory and latency profiling, 512/1024 quality and resource acceptance, hostile raster corpus testing, and process-kill behavior across actual OS targets remain unverified. ComfyUI may continue an already-running job after worker cancellation unless targeted interruption is explicitly enabled on a verified server. No ImageGen/Figma/Canva/MagicPath runtime integration is claimed by these adapters.
