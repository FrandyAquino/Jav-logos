# Architecture and shared contracts

Dependency flow: presentation → application → domain; infrastructure implements application ports. Rust owns filesystem, SQLite, process lifecycle and privileged dialogs. Python workers receive bounded JSON over stdin and emit one JSON result to stdout; diagnostics go to stderr. No shell evaluation.

Frontend source of shared types: `src/domain/types.ts`. A Workspace has `schemaVersion:1`, `revision:number`, `brands:Brand[]`, `concepts:Concept[]`. Native load returns `{snapshot: Workspace|null, revision:number}`. Native save accepts `{snapshot, expectedRevision}` and returns the new revision, rejecting stale writes atomically. Persist full workspace JSON in SQLite with versioned schema; assets use app-data files. Do not silently seed over corrupt data.

## IPC (camelCase arguments; snake_case commands)
- `load_workspace()` → `{snapshot:object|null,revision:number}`.
- `save_workspace({snapshot:object,expectedRevision:number})` → number.
- `provider_health()` → `{available:boolean,provider:string,message:string}`.
- `generate_images({request:{jobId:string,prompt:string,seed:number,count:number,width:number,height:number,referenceBase64?:string}})` → `{images:[{pngBase64:string,seed:number}],provider:string}`.
- `cancel_generation({jobId:string})` → boolean; cancel only the matching owned process.
- `vectorize_image({pngBase64:string})` → SVG string (bounded, sanitized again on frontend).
- `export_file({suggestedName:string,bytes:number[]})` → saved path or null; Rust owns native save dialog; cancellation must not write.

Generation is async in Rust; worker executable/config is resolved from trusted local configuration/environment, not renderer arguments. Bounded count 1–4; image sizes 256–1024; explicit errors. Restart does not auto-replay generation. Python worker commands: `health`, `generate`, `vectorize`, stdin payload matches IPC request (vectorize: pngBase64), stdout JSON matches return shape. Rust launches `JAVLOGOS_PYTHON` (default worker .venv Python when installed), resource path `workers/worker.py`; no subprocess shell.

No arbitrary raw SVG inline rendering. Domain emits safe SVG from typed primitives; imported/vectorized SVG is sanitized with a strict element/attribute allowlist and displayed in an image sandbox. Version edits copy values. User output paths are selected through native dialog.

Application API for presentation: `useStudio()` returns workspace, selectedBrand, selectedConcept, resolvedDna, status, error, busy, providerHealth, theme, plus selectBrand, selectConcept, createBrand(name,parentId?), updateDna(patch), updateBrandName(name), setPrompt(prompt), prompt, generate(provider:'procedural'|'local',count), cancelGeneration, updateConcept(patch), saveVersion, restoreVersion(id), exportKit, exportSvg, exportPng, importReference(file), referenceUrl, clearReference, refreshProvider, dismissError, setTheme. All mutating async actions expose errors; autosave serializes writes. See types for patch shapes.
