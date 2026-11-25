# UI refinement research

Verified 2026-11-25. User asked for JavParlance-inspired polish, appropriate UI/UX/anti-slop skills and the Google font used by Gemini.

## Skill selection

Searched the Skills registry for `ui ux` and `anti slop`; compared results with installed skills. Installation popularity is not a quality guarantee. No new global skill install or update is needed for this task.

- **Impeccable** (`pbakaus/impeccable`): primary guide because its Operate mode addresses actual product UI, hierarchy, state, contrast and refinement of an existing interface. Applied polish/operate/craft-floor references. Installed version4.0.1 is used; a newer version exists but changing global tooling is outside this refinement.
- **UI UX Pro Max** (`nextlevelbuilder/ui-ux-pro-max-skill`): supplemental lookup for accessibility and interaction checks, not a replacement for this product's observed reference or prescribed font.
- **Project frontend/ui-ux skills**: preserve application actions, provenance and local persistence while refining presentation.
- **Emil Design Engineering**: relevant to future detailed motion/component work; this pass keeps motion restrained and does not require an animation library.
- **Design Taste Frontend**: evaluated but not selected as the primary skill. Its own scope excludes dense product/admin/editor-style interfaces; marketing-page anti-slop rules would conflict with this studio's task-focused needs.

Registry sources: https://skills.sh/pbakaus/impeccable/impeccable and https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max . Repository role briefs define explicit ownership and do not pretend to register agents automatically.

## Gemini typography

Live HTML/CSS from https://gemini.google.com/ uses `Google Sans Flex, Google Sans, Helvetica Neue, sans-serif` as its primary stack. The observed body token uses17px/400 and `ROND 0`. This does not mean every Gemini surface has identical typography; code uses a separate monospace family.

Google describes opening these families in2025: https://design.google/library/google-sans-flex-font . Official source and licensing: https://github.com/google/fonts/tree/main/ofl/googlesansflex . Google Sans Flex is not Product Sans.

The original TTF inspected is version5.000, with opsz, wdth, wght, ROND and slnt axes. UI distribution uses unmodified official Google Fonts Latin and Latin-Extended WOFF2 subsets, weights100–900, approximately203KB total. Exact source URLs and hashes are in `public/fonts/google-sans-flex/sources.json`; OFL and trademark notices accompany the fonts. Runtime CSS loads only bundled local files. Other scripts fall back to platform fonts.

The family is applied to application chrome, forms and dialogs. Existing logo documents retain their chosen typography and exported brand identities are not silently changed. No affiliation with Google is implied.
