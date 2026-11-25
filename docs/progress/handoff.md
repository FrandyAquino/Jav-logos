# Development handoff

Implementation commit: `13d2add752ce02b449fb7f33b2fad4022cb0ef82`.

Workspace: this repository, branch `feat/javlogos-studio`. No remote is configured. `git log` is the authoritative commit history. Read `AGENTS.md`, product context, architecture contracts, status and the quality-review receipt before continuing.

## Current runnable output

`src-tauri/target/debug/bundle/macos/JavLogos.app` is the final macOS development bundle. It was rebuilt after source fixes and relaunched successfully. Native QA data remains in the OS app-data directory; it has one brand and five concepts, including a real FLUX raster and trace. The app is left open. No Vite server remains listening on port 1420.

The isolated Python environment is `workers/.venv`. Ignored `workers/config.local.json` references the machine's existing model/runtime files. Do not commit or delete these. Packaged release-mode setup uses the environment/app-data configuration documented in `src-tauri/README.md`; a debug bundle's development-path lookup is not clean-machine provisioning evidence.

## Verification entry points

- `npm run check`: TypeScript, lint, 14 tests and Vite build.
- `npm run test:e2e`: three real Chromium flows; writes ignored screenshots, brand ZIP and recovery JSON.
- `cargo test --manifest-path src-tauri/Cargo.toml --locked --lib`: 15 tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings`.
- `workers/.venv/bin/python -m unittest discover -s workers/tests`: nine tests.
- `workers/.venv/bin/python workers/smoke.py`: actual model invocation; not part of fast CI.

See `native-acceptance.md` and `docs/research/ai-runtime.md` for executed native and inference evidence. `artifacts/` and `workers/artifacts/` are ignored inspection outputs. Keep source checks, browser preview, native acceptance and production release evidence separate.

## Next release work

Provision and verify isolated Python plus model/runtime paths on a clean machine; build and execute Windows/Linux CI and native acceptance; arrange signing/notarization; measure full batch/large-workspace memory and cancellation behavior on target platforms. Expand path editing, font outlines and print exports with explicit document-format/versioning decisions. Verify optional ComfyUI/Diffusers against actual installed runtimes before representing them as accepted providers. Creative SaaS integrations need real end-user API/auth contracts, not development-host connector access.

Do not relabel this development candidate as production-ready merely because the local checks pass. Do not rerun the entire independent review just to reapply findings; use its receipt and the recorded focused regression evidence.
