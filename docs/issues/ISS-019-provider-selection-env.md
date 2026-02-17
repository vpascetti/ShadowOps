# ISS-019: Provider selection via env

Epic: EPIC-P1
Priority: P0
Effort: S
Labels: data, config

## Description
Allow API to switch between stub and IQMS provider via env.

## Acceptance Criteria
- DATA_PROVIDER supports stub or iqms.
- Switching providers requires no code changes outside config.
- Default provider is documented.
