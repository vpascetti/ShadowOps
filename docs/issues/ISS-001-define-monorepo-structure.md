# ISS-001: Define monorepo structure

Epic: EPIC-PLAT
Priority: P0
Effort: M
Labels: platform, monorepo

## Description
Create the new monorepo folder layout and place top-level docs where they belong.

## Acceptance Criteria
- /apps/web, /apps/api, /packages/core, /packages/adapters, /docs exist.
- Existing runtime code is either moved or a migration plan is documented.
- No ERP-specific logic exists outside /packages/adapters.
