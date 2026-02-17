# ISS-022: GET /jobs/:id endpoint

Epic: EPIC-P1
Priority: P0
Effort: M
Labels: api

## Description
Implement GET /jobs/:id for job detail and related operations.

## Acceptance Criteria
- Returns canonical Job and Operation data.
- Handles missing job with a 404 response.
- Uses DataProvider abstraction.
