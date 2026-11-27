# Directed refinement — 2026-11-27

The Refine workspace separates exact composition edits from local AI symbol reinterpretation. Exact edits preview color mappings, background/typeface and optional tinting of an existing transparent cutout, without modifying the source or Brand DNA. Saving creates an independent concept. AI presets (Simplify, More geometric, More organic) and custom instructions produce1–4 derived concepts using the existing local provider, progress/cancellation and save-recovery pipeline.

References are actual512×512 symbol renders, normalized without the composition's rotation so the retained placement/rotation is not applied twice. The editable name/slogan and layout are retained in the AI result's document, not baked into the reference. AI instructions request preservation but do not enforce exact pixel/geometry locks. Original raster colors cannot be changed by an ordinary text-color control; the view explains the available exact-cutout/path or AI alternatives.

Each refinement stores an immutable before PNG with its instruction, kind and source provenance. The comparison survives source edits/deletion and reload. Before images use the native content-addressed PNG storage and validation path. Exact writes and AI completion do not steal a newer selection. Draft previews are inert; failed saves retain the original; AI completed batches retain refinement metadata for retry/recovery. The general generation composer stays mounted but hidden in Refine, preserving its draft/provider settings while avoiding two competing prompt inputs.

## Checks executed

- `npm run check`:70 TypeScript tests, typecheck, ESLint and Vite build passed on Node25.6.1. Initially Node's Web Storage/jsdom global collision (`localStorage.getItem is not a function`) prevented application tests from loading. Verified the workaround, then added `vitest.config.ts` with `--no-experimental-webstorage` scoped to test workers; the standard command now passes without manual environment options. Production/global Node settings were not changed; CI remains on Node24.
- `npx playwright test`:20 Chromium flows passed. New tests cover unsaved preview/reset, exact save, source/DNA preservation, before/after after reload and source deletion, unavailable-provider state, accessibility and compact-width overflow. Reference pixel checks verify a square opaque512px image containing the symbol but no wordmark/slogan.
- After hiding the redundant composer and correcting selected navigation states, focused refinement/UI-quality suite:5 passed. A final targeted refinement suite passed3 tests, adding an adaptive dark background for white symbols so AI inputs remain visible.
- `cargo test --manifest-path src-tauri/Cargo.toml`:23 passed, including before-image storage round-trip. One unrelated opt-in performance diagnostic present in the shared worktree was ignored.
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`: passed.
- Python worker suite:11 passed. Existing image-reference provider protocol is unchanged.
- Native debug bundle built:31.85MiB. Browser previews are not native acceptance; native observations are recorded below.

## Limits

AI may change identity/colors beyond the instruction and may return a nontransparent symbol; review before/after and run background removal as needed. Exact controls operate on editable colors/fonts and supported cutout tints; they do not semantically recolor arbitrary raster regions. Drafts are session UI state; source concepts and saved refinement snapshots persist. No new model, external provider or cloud transmission is introduced. Windows/Linux native interaction and signed releases remain separate gates.

## Native acceptance

Created only `Directed Refinement QA`. Generated one procedural source, previewed/saved an exact Avenir Next → Manrope change, then ran the Simplify preset against that edited concept with1 real local FLUX output. UI reported `Generation complete` / `1 concepts saved`, observed elapsed0:46. Before/after were visually inspected: the model retained the ring/diagonal silhouette and purple palette; it returned a raster with a plain background. This demonstrates reference conditioning and successful saving, not universal adherence or a quality benchmark.

Read-only native SQLite/asset verification found three independent concepts with the source chain intact. Original font remains Avenir Next; exact and AI copies use Manrope. Text, slogan, layout, rotation, scale and tracking are preserved in the AI document. The before PNG is640×480 and submitted reference/output are512×512. Seed663046101; provider FLUX.2 Klein4B / stable-diffusion.cpp. Output SHA256 `2409cbda03256869568fd82d90c5e14beeeb4ea09d4574b1264a3f5de6b54f32`. Receipt and before/reference/result PNGs are in ignored `artifacts/native-refinement-*`. Receipt records actual configured model file/cache-object identities and sizes, without claiming a fresh full model hash audit. The original customer brands were not edited.

The shared checkout also contained an independently developed performance diagnostic and reference paste/drop documentation. Those were preserved and committed separately by their owner; they are not part of the directed-refinement implementation.
