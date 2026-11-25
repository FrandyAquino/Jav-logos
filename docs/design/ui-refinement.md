# JavParlance-inspired workspace refinement

User-directed, 2026-11-25. Mode: Operate. Preserve the three-panel studio, real workflows, provider provenance, native window controls and local-first architecture. Refine the palette, readable type and interaction hierarchy; this is not a marketing page.

## Verified references

JavParlance source: `/Users/frandyaquino/jav-parlance/apps/desktop/src/styles.css`, `App.tsx`, `components/TitleBar.tsx`, `components/ui/button.tsx`; native app inspected read-only. Adopt floating panels, 8px gutters, quiet glass, restrained blue and 44px toolbar density. Do not copy always-on-top/recording controls, frameless-window behavior or faint text. Actual source opacity differs from its older design document, so source and rendered UI are authoritative.

Gemini's current primary UI stack is Google Sans Flex, Google Sans, Helvetica Neue, sans-serif. Google Sans Flex is available under OFL1.1. Bundle official Latin/Latin-Extended WOFF2 and license/trademark notices. This is the application UI family; do not silently restyle saved customer logos or exported brand typography.

## Direction

- Preserve branding mark. Quiet blue-steel palette instead of purple-dominant controls. Dark shell in ink/slate, light shell in cool off-white; artwork stays independent.
- Floating sidebar, central work surface and inspector, separated by 8px gutters with accessible resize hit areas. Native titlebar retained. Glass is a CSS material with an opaque fallback, not a claim of system vibrancy.
- Google Sans Flex, optical sizing auto, weights400/500/600. Body and input text13–14px; supporting labels11–12px minimum. No shrinking to7–9px at compact widths.
- Use accent only for primary generation action, selection and focus. Semantic success/warning/error remain distinct. Text4.5:1 minimum; UI focus and control boundaries3:1.
- Reduce decorative marketing copy, tiny uppercase eyebrows and duplicated badges. Empty states should teach brand creation/generation. Controls use literal action labels.
- Dialogs/popovers get stronger elevation; normal panels stay quiet. Motion is150–200ms for state feedback, disabled under reduced motion. No ambient animation.
- Compact layouts restructure instead of reducing text; all primary controls remain reachable. Keyboard command navigation, focus visibility and platform-specific shortcuts must work.

## Ownership

Visual-system agent: `src/presentation/*.css` except `fonts.css`; may add `tokens.css` and must import root-owned `fonts.css`.
Interaction agent: presentation TSX files only, preserving hook/API contracts and existing class names; new classes documented to visual agent. No app/domain/IPC mutations.
Root: font assets/license/CSS, canonical docs and role briefs, application-level changes if needed, tests, integrated verification, native build and commits.
Final reviewer: read-only visual/accessibility/interaction findings, independent of implementation agents. All use Codex.

## Acceptance

Existing end-to-end flows continue passing. Verify light/dark, empty/populated, gallery/canvas, dialogs, errors/recovery, keyboard commands, 1440×900/1280×800/960×720 and narrow overflow. Check computed font loading from bundled files, contrast, focus, accessible names and reduced motion. Rebuild and inspect the native macOS app. Record actual evidence and remaining production gates separately.
