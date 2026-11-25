# Workspace workflow delivery

Implemented 2026-11-25 from user feedback/screenshots. Chats/charts are the existing brand workspaces; no fake chat backend was introduced.

## Delivered

- Shared accessible Radix Select/FontPicker replaces visible native selects. Radix's clipped aria-hidden form bridge remains internal.
- Draft-only color popover with hex editing, Apply/Cancel, inert Escape/outside dismissal.
- Configurable brand icons; rename, complete/reactivate, archive/restore, pin/unpin and reorder preserve identity, ancestry and designs. Drag to the pinned heading or before pinned rows; Move up/down is the keyboard equivalent. No deletion/cascade on archive.
- Auto-growing prompt editor, richer attachment card/dialog, replace/remove, and Refine image using the selected raster and prompt as the next reference.
- Fifteen font families, ten with bundled open-font assets. Typed compositions use actual fonts; exported composition SVG embeds font data/license and PNG uses that SVG. ZIP kits include licenses. System fonts remain platform-dependent.
- Real job phases, image count, observed sampling steps, elapsed time, bounded logs and completed-image previews. No synthetic percentages or diffusion frames. Polling is non-overlapping and rejects stale jobs; failure readback retains fast-error logs.
- One sd-cli process/model load per batch. Stderr drains continuously with bounded lines/ring rather than failing after64KiB total. Cancellation, timeouts and descendant cleanup remain enforced.

## Verification

- TypeScript:18 tests passed, including pin/self-drop, polling cancellation, recovery terminal state and fast-error logs.
- Rust:21 tests and clippy with warnings denied passed. Metadata/new-font SQLite round-trip, progress bounds, large diagnostics, stale/terminal isolation and observation before EOF are covered.
- Python:11 tests passed, including one process per batch and bounded actual PNG previews.
- Chromium:9 end-to-end flows passed, including lifecycle/drag pinning, rename focus, controls, font export and references.
- WebKit: portable-font export passed; embedded font/license are present and rasterized pixels differ from the unembedded fallback. This is engine evidence, not a native save-dialog claim.
- macOS debug bundle built (~31.30MiB), new controls loaded existing user data and provider health was ready.

Actual worker smoke: two256×256 images in26.352seconds, seeds42/43, distinct hashes and one model load. Ignored receipt/log/images are in `workers/artifacts/observable-batch/`. One smoke run is not a general benchmark.

Actual native UI: created `Workflow QA`, generated two512×512 images. Observed model loading, image1/2 and2/2, sampling steps and80 bounded diagnostics while running. SQLite revision26 confirmed two saved concepts; receipt is `artifacts/native-workflow-receipt.json`. No active deadlock was reproduced; opaque status and repeated model loading were confirmed and addressed.

After generation, computer-use returned `cgWindowNotFound` while the app remained alive and no JavLogos crash report was found. Native font-export/dialog follow-up is unverified; Chromium/WebKit export is not native acceptance. QA data is retained for inspection.

## Review and limits

Two independent Codex reviewers checked UI workflow and native/worker safety. Fixed duplicate completed+pinned rows, self-drop ordering, rename focus, retry terminal status, quiet-state cancellation wording and fast-failure diagnostics. Coordinator ran the tests; reviewers performed read-only inspection.

Latest-job diagnostics last for this app session, not permanent history. Previews appear when the CLI writes outputs. Live optional ComfyUI/Diffusers acceptance, Windows/Linux, signing, clean-machine provisioning and advanced vector editing remain open. Build emits an advisory large-chunk warning (~590KB minified/~186KB gzip); it is not suppressed or called a measured runtime regression.

## Native font-export follow-up

The window was successfully shown again on2026-11-25. In the existing Workflow QA brand, selected Manrope for the first editable composition and exported through the native macOS Save dialog. UI reported `SVG exported`. The written `artifacts/native-manrope-proof.svg` is111,992bytes, parses as SVG, includes four embedded WOFF2 face declarations whose hashes exactly match the bundled Manrope assets, and includes the SIL OFL text. SHA-256: `a211775c44a943031f2bfafd0fc7df9ac40fedaf44f0675648293ea3e8858073`. Receipt: `artifacts/native-font-export-receipt.json`. This closes the previously unverified native SVG font-export/dialog check; it does not certify every font/editor/platform or native PNG export. Only the QA composition was changed; customer David brands were not modified.
