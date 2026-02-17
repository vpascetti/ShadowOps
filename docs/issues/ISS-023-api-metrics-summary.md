# ISS-023: GET /metrics/summary endpoint

Epic: EPIC-P1
Priority: P0
Effort: M
Labels: api

## Description
Implement metrics summary endpoint for KPI tiles.

## Acceptance Criteria
- Returns At-Risk count, Due next 7 days, Overloaded resources count.
- KPIs are derived from canonical data.
- Uses DataProvider abstraction.
