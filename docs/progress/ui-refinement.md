# UI refinement evidence

2026-11-25. Reference: JavParlance source and running native app, inspected without changing it. Font reference: live Gemini CSS plus official Google Fonts assets/license. Design contract: `docs/design/ui-refinement.md`.

## Implemented

- Floating three-panel workspace,8px gutters, compact toolbar, blue/slate palette with coordinated light/dark surfaces.
- Local Google Sans Flex assets (Latin/Latin-Extended, roughly203KB), OFL/trademark notices and exact source/hash manifest. No runtime Google font requests. Saved customer logo typography is unchanged.
- Larger readable labels/controls, useful empty states, restrained motion and opaque/reduced-transparency fallbacks.
- Command palette keyboard selection and platform-specific shortcuts; explicit active-state semantics; correct original/trace/composition labels; contextual errors and provider-check state.
- Dialog focus restoration across palette handoffs. Hidden file inputs removed from Tab order and reference input disabled consistently with its visible trigger.
- Portable visual-director, interaction-engineer and visual-QA briefs plus a repository studio-ui-polish skill/workflow. Skill validation passed.

## Executed verification

`npm run check`: typecheck, ESLint,14 existing frontend tests and production frontend build passed. Existing creation/inheritance, generation/edit/version/export and recovery flows remained intact.

`npm run test:e2e`: six Chromium flows passed, including3 new UI quality flows. Checked empty and populated states, dialogs, command keyboard/focus, gallery, both themes and1440×900,1280×800,960×720,390×844 layouts. Tests verify actual font-face loading from local assets, absence of external font requests,11px minimum composer/control text and reduced-motion behavior. Automated axe checks found zero WCAG2A/2AA/2.1AA violations in the inspected settled states; this is not a full accessibility certification.

The first new QA run exposed one dialog-focus defect, which was fixed. Its initial contrast results sampled theme-transition intermediate colors; the check now awaits finite animations before measuring stable themes, which pass. No contrast threshold was weakened.

Impeccable's mechanical detector ran once over the changed presentation directory and returned an empty finding array. Screenshots are ignored artifacts under `artifacts/ui-v2-*.png`; rendered output was inspected independently of that detector.

An independent Codex reviewer inspected changed TSX/CSS/font setup and screenshots. Its one remaining P2 was the hidden file-input Tab stop; root corrected it. No additional actionable regression was identified. The review did not run browser/native tests itself; those are coordinator-owned.

## Native follow-through

Rebuilt and opened the macOS debug bundle (approximately30.50MiB). Inspected the saved five-concept workspace in both light/dark themes, invoked the command palette with Cmd+K and applied a theme command. Local provider health remained ready and existing artwork/data remained intact.

Native inspection revealed a title strip that stayed in a contrasting system color. Removing its fixed background alone did not consistently resolve both themes. The final macOS configuration uses Tauri's documented transparent titlebar overlay, preserves native traffic-light controls, reserves space for them, and marks the header as a drag region. The completed dark native layout was visually verified with the controls present; light-mode content had also been inspected natively before that structural follow-through. Window theme/background synchronization uses only scoped main-window permissions. No native vibrancy claim is made.

The final app remains open with the user's current workspace/view. JavParlance was inspected read-only and not modified. Rust database/worker implementation did not change in this UI pass; prior backend/inference evidence is preserved rather than relabeled as newly rerun. Windows/Linux runtime acceptance and signed distribution remain open.
