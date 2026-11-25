# ADR: Native authority with isolated workers

Status: accepted for implementation, 2026-11-25.

Tauri 2 hosts React; Rust exclusively owns SQLite, filesystem writes and Python process lifecycle. Pure TypeScript owns Brand DNA and safe geometric document rendering. Python adapters isolate model-specific dependencies.

Why: model formats and hardware runtimes evolve independently of the editor. A worker crash must not corrupt the workspace. Keeping network and filesystem privilege out of the renderer narrows the security boundary.

Storage uses a versioned workspace snapshot with optimistic revision inside a SQLite transaction, and native asset storage. This is deliberately simpler than a distributed entity store; concurrent stale writes fail rather than silently winning. A future multi-document store needs an explicit migration.

Zustand holds UI/application state. TanStack Query is deferred because this slice has no server cache; adding two owners for the same local workspace would add synchronization work. Provider adapters implement a common request/result shape; capability errors must remain explicit.

Browser mode is a preview using localStorage. Native data is separate; browser tests never certify SQLite or packaged IPC.
