---
name: studio-ui-polish
description: Refine or verify JavLogos workspace styling, typography and interaction polish against its JavParlance-inspired design contract.
---

# Studio UI polish

Read `docs/design/ui-refinement.md` and `docs/design/system.md`. Inspect both the current rendered screen and its source before editing.

- UI typography is bundled Google Sans Flex; preserve licensed assets and `public/fonts/google-sans-flex/sources.json`. Never add a runtime Google Fonts request or silently change saved brand-document typography.
- Keep three distinct artwork states: original raster, traced SVG and editable composition. Style the chrome without implying capabilities the artwork does not have.
- Use semantic palette and control tokens. Panel glass must retain readable opaque fallbacks. At compact widths restructure panels; never shrink controls into7–9px text.
- Keyboard commands, dialogs, tabs and resizing must preserve logical focus, selection and cancellation. Use the existing application actions; do not duplicate workspace state in components.
- Run `npm run check` and the relevant Playwright flows, including `tests/e2e/ui-quality.spec.ts`. Inspect captured light/dark screenshots in addition to automated axe results. Native acceptance requires a rebuilt app, not the Vite preview alone.
- Report exact viewports/states checked and any remaining defect. Do not label cross-platform production readiness based on UI-only checks.
