# Logo delivery preparation

Scope: transparent backgrounds, fitted text, horizontal/stacked/monochrome/icon variants, outlined-font SVG delivery. Preserve old documents and original AI assets.

Additive fields: VectorDocument.transparentBackground, autoFitText, wordmarkFit/sloganFit (0.001–1), useCutout. Concept.cutout (PNG), derivedFrom (source concept ID, provenance only). Cutouts are saved as a NEW concept containing the unchanged original raster and generation provenance. Versions reference that concept's immutable cutout. Original concept is never overwritten. Rust asset storage/validation covers cutout PNGs and version dependencies.

Background removal: deterministic local RGBA processing in a Web Worker, bounded to4MP. Estimate a uniform border color, reject inconsistent backgrounds, remove connected background with adjustable tolerance and optional enclosed matching regions. Preserve interior colors; feather/decontaminate edges. Preview before saving. This is flat-background removal, not general photographic AI segmentation. Worker termination cancels pending preview work.

Text fitting: explicit auto-fit switch, off for legacy documents. Measure actual loaded local/browser fonts, compute uniform per-layer fit factors without distorting glyph proportions; recompute inside serialized edits while enabled. Auto-fit may reduce long text to small sizes; preview and warn. Variants always fit their derived copy. Original text/font/size remain editable and history retains earlier documents.

Outlines: fontkit3.0.0 (MIT) reads bundled WOFF2 offline, uses variable weight axes and glyph shaping/kerning, preserves text transforms/anchors and monograms. Dynamic import isolates parser cost. Missing system font bytes or unsupported glyphs fail explicitly without font substitution. Outlined exports contain paths and license metadata, not live text/font dependencies. Raster symbols remain raster and are identified as such.

Delivery dialog: previews derived stacked, horizontal, black/white and favicon presentations, chooses outlined vs embedded text, exports a ZIP containing SVG/PNG variants,16/32/48px PNG and SVG favicon plus provenance/license/usage notes. Monochrome raster requires a cutout alpha mask; trace requires supported editable paths. No misleading recoloring of a white background block. Export cancellation is inert and source concept identity is captured before async work.

Acceptance: RGBA alpha/interior tests, schema/native asset round-trips, long-text bounds at real fonts, outlined glyph geometry/weights/accents, raster transparency pixel checks, ZIP content/favicons, failure and stale-context tests, browser full flow and native smoke. No Windows/Linux release claim.
