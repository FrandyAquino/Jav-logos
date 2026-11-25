# Delivery preparation — 2026-11-25

Implemented the approved first-priority delivery block. Design → Prepare for delivery provides auto-fit name/slogan, transparent canvas, flat-background preview/save, outlined SVG and a variant ZIP. The variant dialog offers vertical, horizontal, black, white and symbol-only favicon outputs;16/32/48px PNG favicon sizes are exact. Variants normalize symbol placement and fit text without rewriting the saved composition. Original AI images and provenance are preserved; cutouts are saved as new concepts and stored through the native content-addressed PNG path. Existing documents retain their appearance unless a new control is enabled.

Font outlines are actual paths from bundled WOFF2 glyphs, including variable weights, accents and monograms. System-only fonts, missing characters and embedded traces containing live text produce actionable errors. Raster symbols remain raster within SVG and are labeled as such. Black/white raster variants require a transparent cutout. Custom path monochrome can merge intentional background/white shapes; the dialog asks users to inspect them.

## Verification

- `npm run check`: strict TypeScript, ESLint,49 tests in21 files and Vite build passed.
- `npm run test:e2e`:15 Chromium flows passed. Added native-size PNG/favicons, actual transparent pixels, long-wordmark bounds, outlined-vs-live geometry, independent cutout persistence/original preservation and variant ZIP inspection.
- Additional focused `tests/e2e/delivery.spec.ts`:3 passed after adding axe WCAG2A/2AA/2.1AA validation of the variant dialog; no violations in that inspected state. Text fit transforms live below motion wrappers so reduced-motion resets cannot discard them. The final outline guard also rejects nested traces with live text rather than claiming font independence.
- `cargo test --manifest-path src-tauri/Cargo.toml`:23 passed including expanded document and stored cutout checks. `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` passed.
- Python worker suite:11 passed. No AI provider logic changed.
- `npm audit --omit=dev --audit-level=high`:0 vulnerabilities reported.
- macOS arm64 debug bundle built and launched. Native WebKit ran the background Web Worker on a real previously generated FLUX symbol in archived `Studio Expansion QA`. Saved `AI concept 1 · cutout`, retained the original and observed the new composition with transparent symbol and auto-fit enabled. Existing customer brands were not modified.
- Native variant dialog displayed all5 actual previews with outlined Manrope text and raster-symbol labels. Exported ZIP through macOS Save; UI reported `Logo variants exported`. Verified5 SVG files with no `<text>` or font-data dependencies,7 PNGs with nonempty alpha and transparent corners, exact16/32/48px favicon dimensions, license and provenance. Receipt: `artifacts/native-delivery-receipt.json`; archive: `artifacts/native-delivery-qa.zip`,475,584bytes, SHA256 `8a378a1395e151dac31d3d8a49829813bdd0a7e0c31bd342ac197e1d3bffeb50`.

Browser screenshots in `artifacts/delivery-*` are separate evidence from the observed native session. The app was returned to the user's pinned JavCollections brand.

## Remote CI follow-up

The first GitHub run for the previous publication commit passed frontend, Python and native Linux jobs. macOS failed two fixtures because a500ms timeout could precede Python writing readiness/cleanup markers. Windows compilation lacked `src-tauri/icons/icon.ico`. Added the ICO using the existing app artwork and increased only those two test startup budgets to5seconds; assertions and production termination/grace behavior remain unchanged. The corrected remote jobs still need execution; local tests cannot certify Windows/macOS hosted runners.

## Limits

Background removal targets flat-color logos, not photographs/gradients. Enclosed removal can erase intentional matching-color details and is optional. Very long fitted text may be small; the inspector warns and the user must inspect it. Fully vector symbols still require tracing/editing; outlining text does not vectorize raster images. Advanced path boolean operations, universal-script typography acceptance, printer/PDF certification, signing/notarization and clean-machine/cross-platform native runtime acceptance remain open. Main JS chunk-size warning remains; font parsing is a separately loaded chunk. No general background model download, cloud upload or mandatory service was added.
