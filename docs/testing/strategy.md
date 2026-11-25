# Verification strategy

Run `npm run check`, `cargo test --manifest-path src-tauri/Cargo.toml`, and the worker test command in `workers/README.md`. Run frontend interaction tests with `npm run test:e2e` when browser dependencies are installed. Native compilation and launch are separate gates.

Domain tests: hierarchy inheritance, explicit overrides, cycles/missing ancestry, consistency reasons, valid workspace references, safe deterministic vector output.
Persistence tests: transactional save, stale revision rejection, reopening database, asset boundary validation. Never test durability solely with a mocked repository.
Worker tests: bounded requests, invalid images, unavailable provider, actual vectorization, cancellation; record real inference separately with model/runtime/seed/output checksum.
UI path: create parent and child, edit inherited properties, generate, edit composition, save/restore version, reload, export and inspect payload. Verify no error console and keyboard accessibility at desktop and narrow viewports.

## Platform matrix

| Target | Build gate | Runtime gate | Release gate |
| --- | --- | --- | --- |
| macOS arm64 | local cargo + Tauri bundle | actual native launch and IPC | signing/notarization, clean-machine AI setup |
| Windows x64 | CI configured | pending actual target | signed installer and inference hardware test |
| Linux x64 | CI configured with WebKitGTK | pending actual target | distro packages and GPU/CPU runtime validation |

CI configuration is not evidence that a remote run passed. No claim of power-loss durability, accessibility certification, cloud integration or production readiness without executed evidence.
