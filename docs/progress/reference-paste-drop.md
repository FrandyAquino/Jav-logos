# Reference image paste and drop

Implemented 2026-11-25. The prompt composer now accepts clipboard images from its textarea or any focused control inside the form, and external file drops anywhere on the form. Both paths call the existing `importReference(file)` action; decoding, the 10,000,000-byte limit, 40-megapixel limit, downscaling, PNG conversion, errors and sequence protection remain centralized there.

- PNG, JPEG and WebP are accepted. Clipboard images with empty or generic `image.*` names receive a friendly name such as `Pasted image.png`; named files retain their names.
- Plain-text paste retains its normal default behavior. Paste is cancelled only after obtaining an image file. The first clipboard image is used; multiple images produce a visible `role="status"` notice that only one reference is used. Multiple dropped files similarly use the first file and announce that choice.
- The drop target uses semantic accent/surface/text tokens, an outline and a status announcement. Nested drag-enter/leave counting prevents child-element flicker; the overlay does not intercept pointer events or add motion. Existing reduced-motion rules still apply.
- No brand, busy generation, archived brand and reference loading disable paste/drop imports just like the attachment button. Disabled handlers leave text paste alone.
- Non-file drags, including text and `application/x-javlogos-brand`, are ignored. Dropped files are deliberately forwarded to the existing validator, including unsupported GIF, SVG and PDF files, so rejection is visible rather than silent. Unsupported clipboard images also reach that validator. Untrusted SVG is never rendered.
- The caption advertises “Paste or drop an image as reference”. The existing reference effect still switches the provider to Local AI.

The main Tauri window sets `dragDropEnabled: false`. The [official Tauri v2 configuration reference](https://v2.tauri.app/reference/config/#dragdropenabled), read during implementation, documents the default as `true` and requires disabling native interception for HTML5 drag/drop on Windows. No IPC, capability, storage or worker contracts changed.

## Executed verification

All commands ran locally on macOS. No packages were installed and no commit was created.

| Command                                                                                                                        | Result                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Baseline `npm run typecheck` and `npm run lint`                                                                                | Passed                                                                                                   |
| Baseline `npm test`                                                                                                            | 49 passed across 21 files                                                                                |
| `npx --no-install vitest run src/presentation/generation-bar.test.tsx`                                                         | 17 passed                                                                                                |
| Final `npm run typecheck`                                                                                                      | Passed                                                                                                   |
| Final `npm run lint`                                                                                                           | Passed                                                                                                   |
| Final `npm test`                                                                                                               | 66 passed across 22 files; 0 failed                                                                      |
| Final `npm run build`                                                                                                          | Passed; Rollup reported Zod comment-annotation and >500 kB chunk warnings                                |
| `npx playwright test tests/e2e/reference-paste-drop.spec.ts tests/e2e/workspace-workflow.spec.ts tests/e2e/ui-quality.spec.ts` | 10 Chromium tests passed; 0 failed (3 new image-input tests, 4 workflow regressions, 3 UI-quality tests) |
| `cargo check` in `src-tauri`                                                                                                   | Passed                                                                                                   |
| `cargo test` in `src-tauri`                                                                                                    | 23 passed; 0 failed; binary/doc targets had 0 tests                                                      |
| `cargo clippy -- -D warnings` in `src-tauri`                                                                                   | Passed                                                                                                   |
| `cargo fmt --check` in `src-tauri`                                                                                             | Passed                                                                                                   |
| `git diff --check`                                                                                                             | Passed                                                                                                   |

An initial post-edit typecheck found missing `parentId` and `createdAt` fields in the archived-brand test fixture. Those fixture fields were corrected before the successful final checks.

Unit coverage checks default-prevented image paste, friendly names, form-wide paste, first-image notice, unchanged text paste, file drop, nested drag transitions, ignored text/internal drags, unsupported-file forwarding and all four disabled states. Browser tests synthesize real `ClipboardEvent`/`DragEvent` objects with `DataTransfer` PNG files and assert the reference card appears, provider switching, preserved prompt text, multi-image notice and existing rejection messages for GIF/SVG/PDF/oversized PNG. Workflow regression includes sidebar drag-to-pin persistence and file-picker preview/removal. UI-quality tests cover both themes, compact layouts, keyboard focus, axe checks and reduced motion. Inspected generated screenshots at dark 1440×900 and light 390×844; the caption remains legible.

## Unverified acceptance

Browser evidence uses local preview storage. Real OS clipboard gestures, external file drags into a rebuilt Tauri window, native sidebar drag reordering after this configuration change, and Windows/Linux native behavior were **not run**. Synthetic browser events do not certify native paste/drop or operating-system clipboard delivery. No native app launch/rebuild or inference run was performed. Python workers were unchanged and their tests were not rerun for this UI/configuration change.

Follow-up guard: `src/main.tsx` prevents default `dragover`/`drop` for file drags at window level, so a file dropped outside the composer (or while the composer is disabled) cannot navigate the webview away now that native drag-drop is off. Re-run after the guard: typecheck and lint passed, 66 Vitest tests passed, and 7 Chromium flows passed (`reference-paste-drop.spec.ts`, `workspace-workflow.spec.ts`).
