# Brand studio expansion

User authorized the seven proposed improvements and clearing the composer after sending. Implement working, honest capabilities rather than decorative controls. Preserve all existing records with additive optional fields.

## Shared model/API

`src/domain/types.ts` owns additive document layout/slogan/visibility/offset/size/symbolSource/custom paths/motion fields, Concept favorite/notes and Brand book copy. Legacy documents keep their exact stacked geometric rendering. Custom geometry is typed numeric cubic nodes/contours, never arbitrary imported markup. Maximum100 paths,200 contours and3000 nodes per document; coordinates/handles bounded±1000; offsets±320; wordmark size12–96 and slogan10–40. Layout stacked/horizontal/symbol/wordmark. Sources geometric/image/trace/custom. Show flags defaulttrue; monochrome defaultfalse; motion defaultnone.

Assets remain Concept.raster/tracedSvg. `renderSvg(document, symbolDataUrl?)` is pure and supports safe data-image assets only. Infrastructure derives sanitized image/trace data URLs; imported SVG never enters DOM inline. Image/trace documents and versions require the corresponding concept asset. Color-preserving source is the original; monochrome applies supported vector paths, not a false claim of raster recoloring.

Generation target: symbol or full-logo. Symbol mode requests a standalone mark without text, then composes the real name/slogan using editable typography. Record the effective request. Existing full-logo behavior remains selectable. New UI mode does not rewrite previous concepts.

On accepted send, capture brand ID, prompt and reference first; clear the input after validation and queued edits complete, before invoking generation. Never clear a newer draft, never clear on preflight failure. Keep submittedPrompt in UI and existing concept/context provenance; offer explicit reuse after failure instead of silently overwriting later input.

Application additions: updateConceptMetadata(id,{favorite?,notes?,name?}), undoConcept(), redoConcept(), canUndo/canRedo, editTracedSymbol(), startCustomSymbol(), generationTarget/setGenerationTarget, submittedPrompt/reuseSubmittedPrompt; updateBrandBook(patch), exportBrandBook(), exportMotion(), previewBrandDna(patch) can be a view-local calculation; apply inherited rules to a chosen concept only on explicit action with undo/version retention. Existing methods and stable IDs remain authoritative.

Presentation views: CompareView({studio}), MockupView({studio}), DnaMapView({studio}), MotionView({studio}); BrandBookView({studio}) root-owned. They reuse ConceptArtwork and preserve original/vector/trace distinctions. Compare2–4 designs with shared surround/scale, favorite/notes, small-size and mono inspection where supported. Mockups are clearly named templates (card/package/web/app/sign) containing the exact selected artwork, not claims of photoreal AI output. DNA map exposes lineage and inherited/overridden field sources; preview is inert until applied.

Vector UI: VectorEditor({studio}) and CompositionControls({studio}), root integrates view. Select path/contour/node; move anchors and cubic handles, add/remove nodes, recolor and align with keyboard/numeric alternatives. Commit at gesture end, not each pointer event. Trace import normalizes sanitized SVG paths with transforms to editable cubic contours, preserving holes/fill rules, and refuses unsupported content rather than dropping it silently.

Quality: contrast, small-size samples, thin-stroke and clipping warnings with concrete reasons. Not trademark/originality certification. Motion presets have real playback and standalone SVG export; draw only when vector geometry is available; reduced motion respected.

Brand book copy is editable in the app and exportable as self-contained HTML with logo variants, palette, type specimens, usage notes and mockups; browser print offers PDF. Do not claim native PDF/PowerPoint or font outlining.

## Exclusive ownership

- Vector/domain agent: domain/vector.ts, new domain/vector-paths.ts, domain/design-quality.ts and their tests; infrastructure/trace-import.ts. Shared types fixed here; root owns schema/native model.
- Exploration views agent: new presentation/studio-views/ compare/mockup/DNA/motion components and CSS only. Root integrates navigation and implements referenced hook methods; coordinate asset rendering through ConceptArtwork.
- Editor agent: presentation/concept-inspector.tsx, new composition-controls.tsx/vector-editor.tsx/editor.css only. No canvas/navigation/domain/schema edits.
- Root: hook/schema/Rust model, asset/font/export integration, book component/export, prompt semantics, shared navigation, installs/tests/docs/native checks and commits.

No worker Git/index operations or shared install/build. All work uses Codex. Tests include legacy round-trips, prompt clearing/provenance/failure, curve conversion, export safety, comparison/mockup source integrity, DNA preview non-mutation, undo/redo and motion controls.
