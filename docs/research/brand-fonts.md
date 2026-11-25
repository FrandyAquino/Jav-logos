# Bundled brand fonts

Allowed names live in `shared/font-families.json`, consumed by TypeScript/Rust. `shared/font-assets.json` records official asset URLs, hashes and license locations. New binaries/notices are in `public/fonts/brands/`; Google Sans Flex remains in its existing directory.

Official Google Fonts CSS and GitHub ofl sources were retrieved on2026-11-25. Latin/Latin-Extended subsets are bundled at400/700 where available; Archivo Black supplies400. New assets/notices occupy approximately604KiB. Other scripts use platform fallbacks.

Bundled: Google Sans Flex, Inter, Manrope, DM Sans, Space Grotesk, Outfit, Playfair Display, Cormorant Garamond, IBM Plex Mono and Archivo Black. Legacy system choices: Avenir Next, Georgia, Helvetica Neue, Courier New and system-ui.

Editor compositions use local faces. Standalone composition SVG embeds font bytes with OFL metadata; ZIP kits also include licenses; PNG rasterizes that SVG. Chromium and WebKit checks confirm the embedded font changes output pixels. Runtime loads remain local.

System-font appearance depends on installation. No font outlining, print certification or universal external SVG-editor support is claimed.
