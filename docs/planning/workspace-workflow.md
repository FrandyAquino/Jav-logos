# Workspace workflow and observability

User-directed continuation, 2026-11-25. Preserve existing brand IDs, ancestry, concepts and generation provenance. The user's chats/charts refer to the existing brand workspaces, not an invented chat service.

## Contracts

Brand gets optional backwards-compatible `status: active|completed|archived`, `pinned:boolean`, `order:number`, `icon:diamond|orbit|flower|type|triangle|waves|grid|layers|spark`. Missing status means active; missing pinned means false. Archive is reversible and affects only that brand, never deletes descendants or assets. Pinning/reordering does not change Brand DNA ancestry. UI actions target explicit IDs: `updateBrand(id,patch)`, `pinBrand(id,pinned)`, `reorderPinnedBrand(id,beforeId?)`. Renaming, completion and archive preserve all designs. An archived selected brand remains inspectable but must be restored before generation.

Native `generation_progress({jobId})` returns `GenerationProgress|null`: `{jobId,phase,message,imageIndex,imageCount,step?,steps?,updatedAt:number,logs:[{at:number,message:string}],previewBase64?:string}`. `phase` is `starting|loading|encoding|sampling|decoding|image-ready|saving|completed|cancelled|failed`. Times are milliseconds since Unix epoch. Logs are a bounded ring (80 lines,500 characters each), preview is a bounded PNG thumbnail. Unknown steps remain absent; never synthesize percentages. Only owned job data is returned; stale jobs cannot update current UI.

Python stdout remains one final JSON result. Optional stderr lines prefixed `JAVLOGOS_EVENT ` carry a JSON object with phase/message/imageIndex/imageCount/step/steps/previewBase64. Other diagnostics are drained and bounded, never interpreted as commands. Stderr line/preview size bounds, cancellation and parent-exit descendant cleanup remain required. Live logs must omit full local paths/prompt dumps where possible. Registry retains the latest job snapshot after completion for diagnostic readback.

Frontend polls native progress with a non-overlapping500ms loop while a local job runs, stops on completion/cancel/unmount, and labels missing provider progress honestly. UI shows elapsed time, current image/count, real steps when available, expandable logs and available image previews. Completed image output is not represented as a live diffusion preview. Preserve final batch-save recovery.

All visible native select controls are replaced by a reusable accessible Radix Select primitive with portal/typeahead/keyboard/focus support. A shared font picker shows real font samples. A shared popover color field keeps a local draft and applies once; Cancel/Escape/outside dismissal leaves the previous color. Inputs remain accessible semantic text fields under styled components.

Compositor remains an accessible textarea internally, presented as an auto-growing prompt editor without native resize chrome or nested borders. Attachment card shows image preview, actual file metadata and remove/replace/preview actions. The main work surface clearly distinguishes selected concept, artwork format and generation progress.

Font families live in `shared/font-families.json`, consumed by TypeScript and Rust validation. New families are bundled from official Google Fonts with licenses. Compositions must render their actual bundled typefaces; SVG exports embed approved font bytes, PNG uses the same prepared SVG. Imported/traced SVG sanitization is unchanged.

## Parallel ownership

- Native/AI agent: `src-tauri/src/worker.rs`, `src-tauri/src/lib.rs`, `workers/**`, `src-tauri/tauri.conf.json` resource entries if a worker module is added. No model/storage schema edits.
- Controls agent: `select-field.tsx`, `font-picker.tsx`, `property-fields.tsx`, `dna-inspector.tsx`, `concept-inspector.tsx`, `studio.tsx`, new `controls.css` and `studio.css` import only. No domain/hook/font assets/tests.
- Composer/workspace agent: `generation-bar.tsx`, `creative-canvas.tsx`, new `generation-progress.tsx`, `reference-card.tsx`, `canvas.css`. Root supplies progress API, font-aware artwork component and attachment metadata.
- Root: domain/schema/model, hook/application orchestration, desktop adapter, brand library, fonts/assets/export, dependency installation, tests/docs and integration/review.

Workers do not stage/commit, mutate peer files or run shared builds. Coordinator owns final checks, meaningful regressions and native acceptance. Production distribution gates remain separate.
