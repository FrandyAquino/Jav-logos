# Native macOS acceptance

Executed 2026-11-25 with the bundled debug `JavLogos.app`, real `tauri://localhost` WebKit content, macOS native accessibility controls and dialogs. This is distinct from browser preview tests.

- App launched and local provider health reported ready.
- Created `JavLogos Native QA`; native SQLite saved it.
- Selected Local AI · FLUX and one concept; actual 512×512 inference completed and displayed the raster.
- Ran Trace image to SVG; the native worker returned a real trace and saved it.
- Exported traced SVG through the native Save dialog into repository `artifacts/`; result 35,825 bytes, 25 paths.
- Opened brand-kit Save dialog and cancelled. UI reported `Export cancelled`; target ZIP was absent.
- Quit and reopened the app. The brand, generated image and trace were restored and provider remained ready.

Read-only post-run inspection of the closed-connection SQLite snapshot showed revision 3, one brand, one concept, provider `FLUX.2 Klein 4B · stable-diffusion.cpp`, seed 1442381488. Raster asset SHA-256 `526a611bc2b587053473be6879b5e629e5482d70e8f69fd44897cdf65bafd8ca`. Trace and exported file both hash to `9199194033f664a4fb73d17e8a6a8b2bf875930a10d077056130ecce5da04827`.

Evidence: ignored `artifacts/native-acceptance.json`, `artifacts/JavLogos-Native-QA-trace.svg`, app-data SQLite/assets. QA data remains in the app for inspection. Browser E2E separately exported and inspected a four-concept brand-kit ZIP and verified reload, versions, keyboard command palette, both themes and 960px layout.

After hardening, rebuilt the debug .app, quit the earlier process, launched the updated bundle, and observed the recovery import control, restored native data and ready provider with no visible errors. Generated four additional geometric concepts through native IPC; SQLite revision 4 contained five concepts, four with the new immutable generation context. The final source and bundle therefore include the review fixes. The original FLUX/trace/export run was not repeated after unrelated slider/reference changes.

Limits: this was a normal quit/reopen, not forced process death or power loss. No Windows/Linux native run, signed installer or clean-machine model setup was certified. Generated image lettering was imperfect; model quality and trademark originality are not guaranteed by pipeline success.
