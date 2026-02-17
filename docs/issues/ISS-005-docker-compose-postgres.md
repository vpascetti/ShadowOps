# ISS-005: Docker compose for Postgres

Epic: EPIC-PLAT
Priority: P0
Effort: M
Labels: platform, database

## Description
Add Postgres docker compose services for canonical persistence.

## Acceptance Criteria
- docker-compose.yml runs Postgres with a named volume.
- Connection details are documented for local dev.
- DB can be started independently of API and Web.
