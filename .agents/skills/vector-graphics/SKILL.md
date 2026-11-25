---
name: vector-graphics
description: Modify SVG composition, tracing or exports in JavLogos.
---

# Vector Graphics

Read `AGENTS.md` and `docs/architecture/contracts.md` from the repository root.

Keep raster original, traced artwork and geometric composition distinct. Sanitize SVG at trust boundaries; test hostile markup and inspect exported artwork.

Return changed paths or findings, actual verification, and remaining limitations. Stay inside assigned ownership; do not overwrite concurrent work.
