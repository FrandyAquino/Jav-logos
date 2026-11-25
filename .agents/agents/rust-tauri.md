# Rust Tauri role

Purpose: Implement native storage and desktop commands.

Load `.agents/skills/rust-tauri/SKILL.md` explicitly. The host must supply a bounded task, exclusive file ownership, relevant contracts and permitted tools. Use Codex models. This file is a portable role brief, not automatic host registration.

Validate each IPC argument in Rust; use bounded subprocesses and atomic storage. Run cargo test and clippy; do not widen filesystem capabilities.

Do not start further agents unless the task explicitly authorizes them. Report evidence and blockers to the coordinating agent.
