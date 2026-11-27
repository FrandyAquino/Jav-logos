# Local 3D mockup rendering

Verified 2026-11-27. Three.js 0.187.0 (MIT) and matching TypeScript declarations run in the existing Vite/React application. The renderer is imported only when Mockups mounts. No server, cloud account or inference worker is involved. The bundled MIT notice is `public/licenses/three.txt`.

Official references consulted:

- https://threejs.org/docs/pages/WebGLRenderer.html
- https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- https://threejs.org/docs/pages/OrbitControls.html

WebGL2 and `EXT_color_buffer_float` are required for the studio materials/environment. Unsupported hardware and lost contexts show a flat artwork fallback and disable mockup export. Retry creates a new canvas/context. Chromium and the installed macOS WKWebView were exercised; Windows WebView2 and Linux WebKitGTK remain unrun.

Lighting uses **Studio Small 09** by **Sergej Majboroda**, distributed by Poly Haven under CC0. The 1K HDR is bundled and loaded from the application origin. It is a reusable source asset, not generated user artwork.

- Source: https://polyhaven.com/a/studio_small_09
- Metadata: https://api.polyhaven.com/files/studio_small_09
- Download: https://dl.polyhaven.com/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr
- License: https://polyhaven.com/license
- Size: 1,615,248 bytes
- MD5 verified against metadata: `d5d7eb9d26d341d6aa4d11c1a54fd97c`
- SHA256: `e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45`

Provenance and license notices accompany the asset in `public/mockups/`. A procedural room environment remains available if local HDR loading fails. Paper, cloth and plaster textures are produced locally. Materials, lighting and perspective simulate a studio presentation; they do not certify physical printing or photographic realism.

Native validation reproduced a blank preview while synchronous export still rendered correctly. A one-shot 100ms fallback now executes pending renders when WKWebView does not deliver animation frames. It cancels the pending frame/deadline after either wins, skips capture/disposal, and does not introduce an idle render loop. A regression test suspends animation frames and verifies scene and camera updates; the rebuilt native app rendered immediately and responded to camera changes.
