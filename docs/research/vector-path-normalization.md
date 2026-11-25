# SVG path normalization

Verified installed package `svgpath`2.6.0 from npm, MIT license (`node_modules/svgpath/LICENSE`), includes `index.d.ts`. Upstream: https://github.com/fontello/svgpath . Used offline to normalize absolute paths, transforms, arcs and smooth commands; quadratic segments are converted to cubic nodes by our adapter. No runtime network or rendering API is involved. `@types/svgpath` is unnecessary and was not installed.

Compatibility validated by strict TypeScript/Vite build, normalization tests and the macOS bundle. Import rejects unsupported elements, paints, opacity and stroke instead of silently removing visual information. Native validation accepts only bounded typed path data. This package is not an SVG sanitizer; the existing sanitizer and typed parser enforce that boundary.
