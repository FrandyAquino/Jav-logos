# JavLogos engineering instructions

JavLogos is an offline-first desktop brand identity studio in JavCollections.
Canonical product context lives in `docs/context/product.md`; architecture and IPC in `docs/architecture/contracts.md`; progress in `docs/progress/status.md`.

- Keep domain logic pure in `src/domain`, orchestration in `src/application`, adapters in `src/infrastructure`, UI in `src/presentation`, native authority in `src-tauri`, isolated inference in `workers`.
- Domain never imports React, Tauri, filesystem or network APIs. Use narrow interfaces and composition; no speculative frameworks.
- SQLite and assets are native app data. Browser mode is explicitly a local preview with its own storage, never desktop acceptance evidence.
- Validate all IPC and worker inputs. Never run shell strings, expose arbitrary filesystem reads, render untrusted SVG inline, or silently send prompts to the cloud.
- Preserve parent/child Brand DNA, provenance, overrides, revisions and failure states. Never claim generated mock geometry is AI output.
- Use Codex provider models only for this build. Independent agents may work in parallel after contracts are committed; assign exclusive ownership and do not revert peers. Parent owns installs, full checks and commits.
- Use kebab-case filenames, strict TypeScript, accessible native form semantics, semantic theme tokens and reduced motion.
- Run relevant TypeScript, Rust and Python tests. Record actual commands/results, distinguish unrun Windows/Linux/native checks, and update docs with every milestone.
- Discover repository skills manually via `.agents/skills/*/SKILL.md`; role definitions are briefs, not automatically registered runtime agents.
- Never commit credentials, model weights, databases, generated assets, `.venv`, build output, or machine-specific configuration.
