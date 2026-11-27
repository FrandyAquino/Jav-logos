# Workspace design system

Mockup studio uses a compact categorized horizontal scene catalog, a dominant 3D stage and grouped appearance controls below it. Wheel gestures scroll the panel; drag or arrow keys rotate the scene, with named camera, zoom and reset buttons as alternatives. Keep original artwork/background choices explicit. Show graphics failures as a flat preview with retry and disabled export. Label the result as a local studio render, not photography or a print proof. Settings are temporary; export captures the current camera at a 2048px longest edge.

The subject is brand-making: keep the artboard dominant, hierarchy legible and inherited rules visible. The refined shell follows JavParlance's floating-panel composition with8px gutters, quiet glass and steel-blue actions. Artwork lives on a neutral artboard independent of shell theme. Native window controls are retained. macOS uses a titlebar overlay with dedicated control space and a draggable header; other platforms retain their standard titlebar fallback. See `ui-refinement.md` for the user-directed brief and reference evidence.

Three panels: brand family → gallery/artboard → contextual inspector. Wide layouts support pointer/keyboard resizing. Compact layouts use fixed columns, then stacked inspector/panels, with resizing controls removed when they no longer apply. The composer and primary actions stay reachable without shrinking text.

The UI uses bundled **Google Sans Flex**, the verified primary Gemini family, with platform fallbacks. Assets, source hashes, OFL and trademark notices live in `public/fonts/google-sans-flex/`; `fonts.css` declares local-only font faces. UI text uses13–14px body/input sizes and11–12px support labels, weights400/500/600, optical sizing auto. Saved brand typography and SVG documents retain their own fonts; UI refinement never silently restyles logos.

Palette/material authority is `src/presentation/tokens.css`: ink/slate dark surfaces, cool off-white light surfaces, blue accent, independent semantic success/warning/error. Panel/control radii and motion timing are centralized there. Use stronger control borders for discoverability and quieter decorative panel borders. Opaque and reduced-transparency fallbacks are required; CSS glass is not native OS vibrancy.

The native window theme/background is synchronized by `src/infrastructure/desktop.ts`. Its two fallback background colors mirror `--base` in `tokens.css`; update them together when changing the shell palette. Permissions are scoped to the main window's theme, background and dragging only.

Use semantic background, surface, text, muted, border, accent and danger tokens for both themes. Reduced motion disables transitions. Focus outlines remain visible; icon-only controls need accessible names. Dialogs trap focus and Escape returns it to their invoker, including command-palette handoffs. The command palette supports filtered arrow navigation and Enter. Platform shortcut hints use Cmd on Apple and Ctrl elsewhere. Programmatically activated file inputs stay outside sequential keyboard navigation. Sliders and splitters expose labels, values and keyboard operation.

Original AI image, traced vector and editable geometric composition are distinct views. Trace does not imply semantic path editing. Brand-consistency scores are transparent rule comparisons of composition properties, not a machine vision verdict on the original raster.

Empty workspace invites brand creation; empty gallery invites generation. Errors remain visible until dismissed; do not replace failed work with sample success. Generation shows the actual provider and supports cancellation. Export cancellation is inert.

Quality gates: `tests/e2e/ui-quality.spec.ts` checks bundled font loading, no runtime Google font request, automated WCAG A/AA checks on settled themes/dialogs, command focus, compact widths and reduced motion. Inspect screenshots in addition to automation. Native macOS and other-platform evidence remain separate.

Select density: shared `SelectField`/`FontPicker` triggers use32px height and13px type. Options use30px rows with font-category descriptions inline, not a second line. Menus cap at320px wide/300px tall even when their trigger stretches across a wide DNA preview panel. Preserve typeface preview, Radix keyboard/typeahead behavior, selection indicators and visible focus. Density tokens live in `tokens.css`.

Generated concept cards expose a separate24px delete control in both thumbnail and gallery presentations. Confirm deletion in a focus-trapped dialog with Cancel initially focused; preserve the target ID, block duplicate submissions, retain the concept on save failure and restore logical focus after closure. Typography specimens use short mixed-case and numeral lines below the family header, avoiding forced full-alphabet wrapping in narrow inspectors.
