# Directed refinement

Provide two explicit operations, without pretending to parse natural language into exact edits:

- Composition editing: preview exact color mappings, background and font changes. Preserve geometry, original imagery, and Brand DNA. Image/trace pixels are unaffected by ordinary palette edits; an existing transparent cutout can be tinted explicitly. Save as an independent derived concept.
- Local AI reinterpretation: simplify, geometric, organic or custom instruction. Rasterize the selected composition's SYMBOL only as a512px reference, so editable wordmarks/slogans are not duplicated in generated pixels. Preserve the source composition's editable typography/layout on new concepts, replacing only the symbol source. Natural-language preservation requests are guidance, not guaranteed pixel/geometry locks.

Add Concept.refinement?: {kind:'composition'|'ai',instruction:string,before:string(PNG)} with existing derivedFrom required for provenance. Before is an immutable full-composition snapshot, independent of later source edits/deletion. Native storage handles it as a content-addressed PNG. AI concepts retain the actual submitted symbol reference, effective prompt, seed/provider and resolved DNA using the existing generation pipeline, cancellation and pending-save recovery. Exact operations are identified as deterministic composition edits; generation provenance remains inherited from the source asset.

Use a Refine workspace view with current concept picker, exact controls, AI presets/instructions, before/after pair and a refinement-history selector. Draft previews do not persist. Each operation captures source ID, consumes queued saves and rejects missing/archived source brands. Saves never switch a newer selected brand/concept. Buttons prevent duplicate submission; preflight failure does not clear drafts. New fields are additive; legacy workspaces/recovery payloads remain readable. No model/runtime install or cloud fallback.

Acceptance: pure color/type changes preserve paths and source; native PNG metadata round-trip; exact-save failure/retry and source-switch races; AI reference/intent/provenance; cancellation/late result and recovery; preview/compare/history after reload/deletion; real local reference smoke separated from mocked-provider tests.
