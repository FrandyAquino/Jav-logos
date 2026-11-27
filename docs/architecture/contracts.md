# Architecture and shared contracts

Dependency flow: presentation → application → domain; infrastructure implements application ports. Rust owns filesystem, SQLite, process lifecycle and privileged dialogs. Python workers receive bounded JSON over stdin and emit one JSON result to stdout; diagnostics go to stderr. No shell evaluation.

## Mockup studio

`src/domain/mockups.ts` owns the scene catalog and bounded appearance settings. `src/infrastructure/mockups/` rasterizes existing sanitized/font-prepared compositions, preserves original raster pixels/backgrounds, crops transparent margins and implements local Three.js materials, geometry, lighting and PNG capture. Presentation owns temporary settings and a single disposed-on-unmount renderer; no scene settings enter the workspace schema. Sources are composition, symbol, original and saved cutout. Foil styling never changes the saved logo.

`exportMockup(conceptId,sceneId,capture)` guards duplicate work, flushes pending writes, captures the latest saved concept/brand and calls the render callback. It validates the scene ID, PNG signature and 32MiB bound before using the existing native `export_file`. Cancellation is inert. The preview restores its current artwork after capture. Rendering uses animation frames with a one-shot deadline for native windows whose frames are suspended; no continuous render loop or remote request is needed. Unsupported/lost WebGL disables export and offers a flat preview/retry.

Frontend source of shared types: `src/domain/types.ts`. A Workspace has `schemaVersion:1`, `revision:number`, `brands:Brand[]`, `concepts:Concept[]`. Native load returns `{snapshot: Workspace|null, revision:number}`. Native save accepts `{snapshot, expectedRevision}` and returns the new revision, rejecting stale writes atomically. Persist full workspace JSON in SQLite with versioned schema; assets use app-data files. Do not silently seed over corrupt data. New concepts can include immutable `generationContext` and an original PNG `reference`; legacy concepts omit them. String limits are UTF-16 units, matching JavaScript; identifiers allow 1–128 ASCII letters, digits, hyphens and underscores.

## IPC (camelCase arguments; snake_case commands)

- `load_workspace()` → `{snapshot:object|null,revision:number}`.
- `save_workspace({snapshot:object,expectedRevision:number})` → number.
- `provider_health()` → `{available:boolean,provider:string,message:string}`.
- `generate_images({request:{jobId:string,prompt:string,seed:number,count:number,width:number,height:number,referenceBase64?:string}})` → `{images:[{pngBase64:string,seed:number}],provider:string}`.
- `cancel_generation({jobId:string})` → boolean; cancel only the matching owned process.
- `generation_progress({jobId:string})` → matching bounded job snapshot or null; see `docs/planning/workspace-workflow.md` for fields and phases.
- `vectorize_image({pngBase64:string})` → SVG string (bounded, sanitized again on frontend).
- `export_file({suggestedName:string,bytes:number[]})` → saved path or null; Rust owns native save dialog; cancellation must not write.

Generation is async in Rust; worker executable/config is resolved from trusted local configuration/environment, not renderer arguments. Bounded count 1–4; image sizes 256–1024; explicit errors. Restart does not auto-replay generation. Python worker commands: `health`, `generate`, `vectorize`, stdin payload matches IPC request (vectorize: pngBase64), stdout JSON matches return shape. Rust launches `JAVLOGOS_PYTHON` (default worker .venv Python when installed), resource path `workers/worker.py`; no subprocess shell.

No arbitrary raw SVG inline rendering. Domain emits safe SVG from typed primitives; imported/vectorized SVG is sanitized with a strict element/attribute allowlist and displayed in an image sandbox. Version edits copy values. User output paths are selected through native dialog. Generation results that fail persistence remain in memory with retry/save-recovery actions; recovery JSON imports merge IDs without overwriting existing identities. Exports and generation await prior queued writes.

Application API for presentation: `useStudio()` returns workspace, selectedBrand, selectedConcept, resolvedDna, status, error, busy, providerHealth, theme, plus selectBrand, selectConcept, createBrand(name,parentId?), updateDna(patch), updateBrandName(name), setPrompt(prompt), prompt, generate(provider:'procedural'|'local',count), cancelGeneration, updateConcept(patch), saveVersion, restoreVersion(id), exportKit, exportSvg, exportPng, importReference(file), referenceUrl, clearReference, refreshProvider, dismissError, setTheme. All mutating async actions expose errors; autosave serializes writes. See types for patch shapes.

## Library and typography additions

Brands accept optional status/pinned/order/icon fields; absent values preserve legacy active/unpinned behavior. Archive is reversible and does not delete descendants. Font names are shared by TypeScript/Rust via `shared/font-families.json`; approved font assets/licenses are indexed in `shared/font-assets.json`. Only typed primitive compositions render inline; untrusted traces remain sanitized image sources. Trusted composition exports embed approved font data and licenses.

## Composition expansion

`VectorDocument` optionally carries layout, separate slogan and layer controls, symbol source, cubic paths and motion. `Concept` adds favorites/notes; `Brand` adds book copy. Optional values preserve older records. `src/domain/schema.ts` and `src-tauri/src/vector-model.rs` validate bounds, global path/node IDs and paired handles; image/trace documents and saved versions require concept assets. Maximum100 paths,200 contours,3000 nodes, coordinates±1000. Image/trace symbols cannot use vector monochrome/draw until converted to typed paths.

Infrastructure selects composition assets and embeds approved fonts; imported markup stays in image data URLs. Trace import normalizes supported paths with `svgpath` into typed cubic contours. `updateConcept` supports patches and full document replacement for version restore; persisted edits and history transitions share the serialized write queue. Undo/redo is bounded session state, while explicit versions persist.

Brand-book HTML exports contain escaped copy and self-contained image/font assets without scripts. Native export permits svg/png/zip/json/html only. Motion SVG comes from the trusted primitive renderer; no user-authored animation code is evaluated. See `../planning/brand-studio-expansion.md` for the complete feature contract.

`deleteConcept(id): Promise<boolean>` removes only that concept via the serialized workspace save. Failure retains both the record and selection. Success clears its session history and selects an adjacent concept from the same brand only when necessary. Per-ID in-flight guards prevent duplicate deletion writes; native schema/IPC remain unchanged. Asset garbage collection and deletion of independently exported files are not part of this action.

## Delivery preparation

Additive document flags `transparentBackground`, `autoFitText`, `useCutout` and uniform `wordmarkFit`/`sloganFit` factors (0.001–1) preserve legacy behavior when absent. Concept `cutout` is a validated/stored PNG; `derivedFrom` is a provenance identifier, not a live foreign key. Current documents and versions with `useCutout` require the asset. Removing a source concept does not invalidate its independent derivative.

Auto-fit recomputes inside the serialized edit transform and again for exported arrangements using actual loaded font metrics. Cutout processing runs in a cancellable Web Worker; `saveCutout(id,png)` creates an independent concept, never overwrites the original, and guards duplicate calls. Native PNG asset storage includes cutouts. `exportDelivery(id,variants,outlined)` captures the source and exports a user-selected ZIP; `exportOutlinedSvg` uses bundled font files and glyph paths without font substitution. See `../planning/delivery-preparation.md` for bounds and `../research/font-outlines.md` for verified dependency/license details.

## Directed refinement

Concept.refinement optionally records `kind: composition|ai`, a bounded1500-character instruction and a validated before PNG; `derivedFrom` is required as provenance without a live foreign-key dependency. Rust reads/writes the before image through the same hashed PNG asset path as original/reference/cutout images. Recovery/export snapshots retain the record. Existing concepts without this metadata remain valid.

`refineComposition(sourceId,changes)` creates a derived concept from an explicit color mapping, background/typeface or saved-cutout tint. The queued transaction captures the latest source, renders the before snapshot and saves the independent result. `refineWithAi(sourceId,instruction,count)` uses the existing generation orchestration and cancellation/recovery, with an actual normalized symbol reference and original editable typography/layout. `generate` now returns a boolean indicating successful persistence; callers that only trigger it may ignore the result. Refinements capture source IDs and avoid overwriting an unrelated newer selection, including pending-save retries.
