# ISS-021: GET /jobs endpoint

Epic: EPIC-P1
Priority: P0
Effort: M
Labels: api

## Description
Implement GET /jobs?status=open using the DataProvider abstraction.

## Acceptance Criteria
- Supports status filter with ERP-neutral values.
- Results are risk-ranked by default.
- Uses DataProvider and not direct ERP logic.
