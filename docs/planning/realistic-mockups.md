# Studio mockups

Replace five flat CSS applications with an offline Three.js studio renderer and fourteen material/geometry-specific scenes: business cards, stationery, rigid box, kraft mailer, paper shopping bag, cotton tote, folded shirt, ceramic mug, metal bottle, takeaway cup, wall plaque, round shop sign, laptop and phone. Procedural paper/fabric/plaster textures are generated locally; a bundled CC0 studio HDR environment supplies reflections and illumination. No runtime network request, user-logo upload or model inference is needed.

The actual selected artwork becomes a texture, with composition/original/cutout/symbol source choices. Composition artboard backgrounds are explicitly optional; raster image backgrounds are never silently erased. Crop only transparent margins and preserve aspect ratio. Material and foil/ink styling are mockup settings and do not modify Brand DNA or saved logos.

One dynamically loaded WebGL2 renderer, physically based materials, environment lighting, soft shadows, curved/flat print surfaces and deliberate camera presets. Pointer orbit has keyboard-accessible preset/zoom/reset alternatives; wheel scrolling stays available for the panel. Render only on demand; dispose geometries/materials/textures/controls/context on replacement/unmount. Context loss or unsupported WebGL produces an honest flat-art fallback with export disabled.

UI: compact categorized scene catalog, dominant render stage, source/material/color/print-size controls and2048px PNG export of the actual scene/camera. Native export uses the existing validated export_file command. No new persistence schema. Main-thread interactive controls never start inference. Rendered previews are not photographs or print color proofs.

Acceptance: image-source fidelity/background/cropping tests, no mutation to saved concepts, actual WebGL rendering across all scenes, lifecycle/context fallback, PNG signature/dimensions/nonempty pixels, light/dark and compact controls, camera/reset/zoom, accessibility and native app export.
