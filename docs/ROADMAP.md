# ShadowOps Roadmap (Weeks 1-8)

## Milestone Plan

### Weeks 1-2: Phase 1 - Early Warning
- Canonical model and risk scoring in /packages/core
- DataProvider abstraction with StubProvider and IQMS adapter skeleton
- API endpoints: /health, /jobs, /jobs/:id, /metrics/summary
- Web UI with risk-ranked jobs, filters, job detail view, KPI tiles
- Unit tests for canonical validation and risk scoring
- Docs: ARCHITECTURE.md, PROJECT_BOARD.md

### Weeks 3-4: Phase 2 - Constraint Awareness (Lite)
- Material availability and capacity pressure flags
- Constraint annotations in API and UI
- Basic tests for constraint logic

### Weeks 5-6: Phase 3 - Performance Deviation
- Historical vs current rate comparison logic
- Deviation thresholds and slowdown indicators
- UI annotations and tests

### Weeks 7-8: Phase 4 - Operational Tendencies
- Historical lateness frequency metrics
- Chronic risk flags and rolling tendency metrics
- UI indicators and stabilization

## Notes
- ERP-agnostic core logic remains in /packages/core only.
- ERP-specific mapping stays isolated in /packages/adapters.
- Phase 1 is the only build target until explicitly scheduled.
