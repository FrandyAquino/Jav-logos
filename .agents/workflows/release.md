# Release gate

Run frontend, native and worker checks. Validate real inference separately from procedural generation. Build and launch each target, exercise the complete native persistence/export path and restart recovery. Review IPC/SVG/process security, dependency licenses, signed packaging, clean-machine runtime provisioning and offline operation. Record each target as passed, failed or unrun. Do not mark production-ready when any required target gate is unrun.
