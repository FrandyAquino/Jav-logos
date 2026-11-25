# Stack compatibility and licenses

Verified 2026-11-25 against the installed lockfiles and executed local checks.

| Package | Resolved version | Manifest license |
| --- | --- | --- |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| vite | 7.3.8 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| tailwindcss | 4.3.5 | MIT |
| zustand | 5.1.0 | MIT |
| zod | 4.6.7 | MIT |
| dompurify | 3.5.0 | (MPL-2.0 OR Apache-2.0) |
| fflate | 0.8.3 | MIT |
| @tauri-apps/api | 2.12.5 | Apache-2.0 OR MIT |
| @radix-ui/react-dialog | 1.3.1 | MIT |
| lucide-react | 0.468.0 | ISC |

Tauri resolves to 2.12.7 and requires Rust 1.90 or later; host Rust 1.96 passes. React 19 + Vite 7 + TypeScript 5.9 + Tailwind 4 production build passes on Node 24. Node 24 is pinned in CI. SQLite is compiled via bundled rusqlite. Python 3.12 runs in workers/.venv; system Python 3.9 is not used for inference.

Official Tauri documentation was retrieved via Context7 /tauri-apps/tauri-docs: https://v2.tauri.app/security/csp/ and https://v2.tauri.app/plugin/dialog/ . CSP allows only local IPC and bundled/blob/data imagery; save destinations are selected by Rust native dialog. Platform prerequisites: https://v2.tauri.app/start/prerequisites/ .

Dependency manifest licenses are an inventory, not a full transitive legal audit. Model/runtime sources and licenses are in ai-runtime.md. Model weights are not redistributed. The UI refinement bundles Google Sans Flex subsets with OFL/trademark notices; see ui-skills-and-typography.md. Brand-document fonts are not embedded in exports. No subscription is required.

Optional ImageGen/Figma/Canva/MagicPath connectors are available to the development environment but that does not establish redistributable desktop APIs or end-user authentication. No runtime integration is claimed or silently enabled.
