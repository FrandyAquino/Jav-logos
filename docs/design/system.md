# Workspace design system

The subject is brand-making: keep the artboard dominant, hierarchy legible and inherited rules visible. Shell surfaces use slate and translucent blue-gray; periwinkle indicates active controls. Artwork lives on a neutral paper artboard independent of shell theme. Native titlebar is retained for reliable platform window controls.

Three panels: brand family → gallery/artboard → contextual inspector. At narrow widths, inspectors may stack rather than squeeze the canvas. Panel widths are user-controlled. Typography uses locally available system fonts; no network font request. Exported SVG names fonts but does not embed licensed fonts.

Use semantic background, surface, text, muted, border, accent and danger tokens for both themes. Blur is decorative with opaque fallback. Reduced motion disables transitions. Focus outlines remain visible; icon-only controls need accessible names. Dialogs trap focus and Escape returns it to the trigger. Sliders and splitters expose labels, values and keyboard operation.

Original AI image, traced vector and editable geometric composition are distinct views. Trace does not imply semantic path editing. Brand-consistency scores are transparent rule comparisons of composition properties, not a machine vision verdict on the original raster.

Empty workspace invites brand creation; empty gallery invites generation. Errors remain visible until dismissed; do not replace failed work with sample success. Generation shows the actual provider and supports cancellation. Export cancellation is inert.
