# Implementation roadmap and acceptance

1. Foundation: verified toolchain, explicit contracts, portable agent briefs, strict build, CI. Gate: reproducible dependency installation and contract review.
2. Independent implementation wave: Rust persistence/process authority; Python adapters and actual model smoke test; presentation shell. Host owns domain, state, vector/export integration. Gate: pure-domain tests, backend tests, worker tests, successful frontend build.
3. Integration: hierarchy inheritance and overrides, generation status/cancellation, vector editing, references, versions, consistency and brand kit. Gate: create→generate→edit→save→reload→export with failures visible and no fabricated AI results.
4. Hardening: security review, runtime inspection, packaging, supported OS CI configuration, accessibility. Gate: native macOS build and launch plus executed tests; Windows/Linux release acceptance requires real target runs.

Release backlog: signed/notarized installers on all targets, reproducible AI runtime distribution, full path-node editing and font outlining, certified print/PDF exports, advanced reference refinement, verified optional integrations, realistic load/performance/recovery trials. Production readiness is gated by evidence, not by the existence of CI files.
