# Native runtime

Tauri 2.12.7 resolves from `Cargo.lock` and requires Rust 1.90 or later. The initial host was macOS arm64 with Rust 1.96.0. Build from the repository root with `npm run tauri dev` or `npm run tauri build` after frontend dependencies are installed.

Native checks:

```sh
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

## Data and recovery

The OS app-data directory for `com.javcollections.javlogos` contains `javlogos.sqlite3`, its SQLite WAL sidecars, and `assets/`. On macOS this normally resolves to `~/Library/Application Support/com.javcollections.javlogos/`.

SQLite stores the current workspace and its immediately preceding snapshot in `workspace_backup`. Saves use immediate transactions and an expected revision. Raster PNG and traced SVG contents are written to SHA-256-addressed asset files before the referring transaction commits; unused files can remain after a failed save. They are intentionally not garbage-collected yet. Load verifies hashes and fails visibly on corrupt data; it never silently replaces a corrupt workspace.

To preserve data for manual recovery, close JavLogos and copy the entire app-data directory, including WAL sidecars and assets. Do not copy a live database file alone. Restoring `workspace_backup` is currently a manual operation on the copied database, not a certified automatic recovery feature. Abrupt power-loss recovery has not been tested.

## Isolated AI runtime

Only worker source modules and requirements are bundled. No interpreter, model weights, local configuration or credentials are bundled.

Development finds `workers/.venv/bin/python` (`Scripts/python.exe` on Windows). Packaged builds use an absolute `JAVLOGOS_PYTHON` path or an interpreter installed under app-data `runtime/.venv/`. Set `JAVLOGOS_WORKER_CONFIG` to a trusted absolute local configuration file for a packaged app; Finder-launched applications do not automatically inherit terminal environment variables.

The renderer cannot provide executable names or shell commands. One image generation runs at a time, with a 15-minute timeout; vectorization has a 60-second timeout and provider health 20 seconds. Stdout and stderr are bounded. Cancellation targets a registered job; Unix workers run in an owned process group whose ID is retained after parent exit. SIGTERM permits up to twelve seconds of cleanup before SIGKILL; ComfyUI cleanup calls each have a two-second deadline. Windows termination uses the owned PID with `taskkill /T`. Normal application exit waits for active generation cancellation. Forced termination of the desktop app and Windows process-tree behavior still need platform acceptance tests.

## Security and platform evidence

The renderer has no shell or general filesystem plugin permissions. Custom IPC inputs are validated. SVG is opaque text to Rust; presentation must sanitize it before rendering or exporting. Export destinations come from a native save dialog; cancellation writes nothing and selected outputs are written via a same-directory temporary file and rename.

The window uses a reliable native opaque fallback. CSS glass effects do not imply native window vibrancy. macOS compilation, unit/process tests and native save-dialog flows passed; see `docs/progress/native-acceptance.md`. Signed installers, Windows/Linux runtime behavior, and release AI runtime provisioning still require separate acceptance evidence.
