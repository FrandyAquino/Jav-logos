# JavLogos

A local-first desktop logo and brand identity studio for JavCollections, built with Tauri 2, Rust, React and isolated Python inference.

**Current delivery: functional development build, not a certified production release.** Real FLUX.2 Klein 4B generation, reference refinement, tracing, SQLite persistence, native SVG export and restart recovery were exercised on macOS Apple Silicon. Windows/Linux runtime acceptance, signed installers and clean-machine AI provisioning remain release gates.

## Run

Requires Node 24+, Rust 1.90+, platform [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and Python 3.12/uv for local inference.

```sh
npm ci
npm run tauri dev
```

Geometric concept generation works immediately without an AI model. To enable local FLUX, follow [worker setup](workers/README.md); the worker uses existing local model paths and does not download weights automatically. Runtime configuration and model files stay local and are not included in this repository.

```sh
npm run dev                       # browser preview; separate browser storage
npm run tauri -- build --debug --bundles app  # macOS development .app
npm run tauri build               # host-platform release build
```

The macOS development app is at `src-tauri/target/debug/bundle/macos/JavLogos.app`. It is unsigned development output, not a redistributable signed release. Release-mode Python setup is described in [native runtime notes](src-tauri/README.md).

## Create a brand identity

1. Create a parent brand and set its palette, typography, geometric language and personality.
2. Add a sub-brand to inherit those rules. Override a field or reset it to inheritance.
3. Describe a logo and generate 1–4 concepts. Choose **Geometric concepts** for editable procedural studies or **Local AI · FLUX** for actual model inference. A visual reference applies to local AI.
4. Inspect the original AI image or compose its symbol with an editable wordmark and slogan. Arrange layers, convert supported traces to editable paths, and save versions before exploring changes.
5. Export composition SVG/PNG, traced SVG, or a ZIP brand kit with original imagery, vector assets, palette and provenance. Bundled open fonts are embedded in composition SVG; system fonts still require installation.
6. Compare concepts, keep favorites and notes, preview 14 interactive 3D mockups, inspect inherited Brand DNA, and export animated SVGs or an editable-in-app brand book as self-contained HTML.
7. Use each brand’s menu to rename, complete, archive/restore or pin it. Drag a brand into Pinned or use Move up/down to reorder. Delete unwanted concepts from their thumbnail or gallery card after confirmation.

See the [quick-start guide and example prompt](docs/context/quick-start.md). Accepted prompts clear automatically and remain available under Last sent prompt.

Local generation now shows actual worker stages, current image, sampling steps when reported, elapsed time and bounded logs. The runtime loads models once per batch. Refine image reuses the selected raster/prompt as the next reference.

If generation finishes but saving fails, keep the window open and choose **Retry save** or **Export recovery copy**. Import that JSON later through the command palette. Recovery import preserves concept IDs and does not rerun inference. Existing IDs are retained rather than overwritten.

Generated raster typography can contain model errors. Composition wordmarks are editable text. Supported traces can be converted to editable Bézier paths with anchor/handle controls and undo/redo. Prepare for delivery adds flat-background removal, automatic text fitting, transparent canvases, logo variants and font outlines using bundled typefaces. Advanced boolean operations and print certification remain outside the current delivery. Inspect small text and artwork bounds before export.

## Refine a direction

Open **Refine** on a saved concept. Preview exact color/typeface edits, or choose **Local AI** to simplify/reinterpret the symbol with a natural-language instruction. Each result is a separate concept with a persistent before/after snapshot and source provenance. The local AI route retains editable wordmarks/slogans and uses a symbol-only reference. Preservation is model guidance, not a guaranteed geometry lock.

## Prepare a logo for delivery

In **Design → Prepare for delivery**, enable **Auto-fit name and slogan** and **Transparent canvas**. For an AI image with a uniform background, use **Remove flat background**, inspect the preview and save a new cutout concept. The original remains intact.

Choose a bundled typeface such as Manrope or Google Sans Flex for **Outlined SVG**. **Logo variants** exports vertical/horizontal, black/white and favicon versions as SVG/PNG, with exact16/32/48px PNG icons, licenses and provenance. A raster symbol stays raster inside the SVG; outlining converts the text only. See [delivery evidence and limits](docs/progress/delivery-preparation.md).

## Present a logo in context

Open **Mockups** on a saved concept. Choose among 14 scenes for print, packaging, merchandise, signage and devices. Rotate the scene, adjust surface/background colors, size and print finish, then **Export mockup PNG** at a 2048px longest edge. Everything renders locally, including bundled studio lighting. For clean prints, choose a transparent cutout or a vector composition; opaque raster backgrounds remain visible. These are 3D studio simulations, not print proofs. See [mockup verification and limits](docs/progress/realistic-mockups.md).

## Verify

```sh
npm run check
npx playwright install chromium
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml --locked --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
workers/.venv/bin/python -m unittest discover -s workers/tests
workers/.venv/bin/python workers/smoke.py
```

Tests do not require cloud accounts. The last command executes the configured local model. Read [verification status](docs/progress/status.md) for what actually ran; CI configuration alone is not proof of platform support.

## Project map

- [Product context](docs/context/product.md), [architecture contracts](docs/architecture/contracts.md), [design system](docs/design/system.md)
- [Roadmap and acceptance gates](docs/planning/roadmap.md), [testing strategy](docs/testing/strategy.md), [AI research and evidence](docs/research/ai-runtime.md)
- [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), `.agents/skills/`, `.agents/agents/`, `.agents/workflows/`

No telemetry, required login, subscription or automatic cloud generation. Optional ComfyUI/Diffusers adapters exist but are not live-inference certified here. ImageGen, Figma, Canva and MagicPath are not connected runtime features.

## Repository and automation

Source: [FrandyAquino/Jav-logos](https://github.com/FrandyAquino/Jav-logos), branch `main`. GitHub Actions runs frontend/browser and Python checks plus native build checks for macOS, Windows and Linux on pushes and pull requests. A successful CI build does not certify native runtime behavior or provide a signed installer. Model weights, local configuration, databases and generated assets are excluded from Git.
