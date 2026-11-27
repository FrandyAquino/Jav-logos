# Mockup studio delivery — 2026-11-27

Replaced five CSS previews with fourteen local 3D scenes: cards, stationery, rigid box, kraft mailer, shopping bag, cotton tote, folded shirt, ceramic mug, water bottle, takeaway cup, office plaque, shop sign, laptop and phone. See [plan](../planning/realistic-mockups.md), [renderer research and licenses](../research/mockup-rendering.md), and [contracts](../architecture/contracts.md#mockup-studio).

The studio provides categorized scenes, material-specific geometry/textures, HDR lighting, soft shadows, orbit/camera/zoom, surface/backdrop colors, logo scale/placement, original ink or gold foil, and PNG export with a 2048px longest edge. Composition, symbol, original raster and saved cutout sources remain explicit. Opaque image backgrounds are preserved; background removal creates an independent concept through the existing workflow. Mockup settings are temporary view state, not persisted documents.

## Executed checks

- `npm run check`: TypeScript, ESLint, 72 tests in 26 files and Vite production build passed.
- `npm run test:e2e`: 25 Chromium flows passed before the native render scheduling correction.
- `npm run test:e2e -- tests/e2e/mockups.spec.ts`: final 5 flows passed in 48.3s, including all 14 actual WebGL scenes, camera/material/export behavior, source pixel/background preservation, light-theme axe checks, compact layout, renderer remount, missing WebGL, context-loss recovery and suspended animation frames.
- `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities.
- `npm run tauri -- build --debug --bundles app`: final macOS arm64 debug bundle built, 33.20 MiB, installed in `/Applications/JavLogos.app` with a prior app backup under ignored artifacts.
- Native UI: initial cards render, mug selection, frontal camera and native Save dialog exercised using existing Directed Refinement QA data. Status reported **Mockup exported**. No brand/concept edits or generation were required.
- Native PNG: 2048×988, 247,758 bytes, SHA256 `2771d5db1254109897088264fafd915b6700e0615d0ec8685626b70e4fbb7bac`. Ignored local evidence: `artifacts/native-mockup-qa.png` and `artifacts/native-mockup-qa.json`.
- Installed executable SHA256: `1a58f69e5b3bdc8f833e435332cc16b4494ad7197fdbdd2b3970ec8081af3afd`.

Native testing found a blank preview caused by pending animation-frame rendering; synchronous PNG capture worked. A bounded rendering fallback corrected the issue, a browser regression reproduced suspended frames, and the installed rebuild was checked again. See research for the mechanism. An earlier Chromium run also encountered a transient graphics-context failure; later full/scoped runs passed. This is evidence for tested paths, not a claim that every GPU is supported.

## Limits

Windows/Linux native behavior, signed distribution and clean-machine acceptance remain unrun. Rust/Python source and persistence schemas did not change; their suites were not rerun for this frontend milestone. The Vite main chunk (~733KB) and lazy renderer (~627KB, ~160KB gzip) retain size warnings. There is no measured memory/latency benchmark or print-color certification. These are studio renders, not photographs. Settings reset when the view is unmounted; saved mockup presets, imported 3D models, batch export and photographic background compositing are future work.
