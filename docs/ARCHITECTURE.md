# ShadowOps Architecture

## Canonical Model
ShadowOps operates on an ERP-neutral canonical data model defined in /packages/core. The minimum entities are:
- Job
- Operation
- Resource
- MaterialRequirement

All validation and risk scoring are computed against this canonical model.

## Adapter Pattern
ERP-specific logic is isolated in /packages/adapters. Each adapter maps ERP fields to the canonical schema without business logic. The IQMS adapter is the first implementation and can be swapped by configuration.

## Data Provider Abstraction
The API reads from a DataProvider interface defined in /packages/core. Providers can be switched via the DATA_PROVIDER environment variable without code changes outside configuration.

Supported providers:
- StubProvider: JSON fixtures for local development
- IQMSProvider: SQL adapter skeleton

## Data Flow
1. API selects a DataProvider based on DATA_PROVIDER.
2. Provider returns canonical entities.
3. Risk scoring runs in core and remains ERP-neutral.
4. UI consumes API endpoints with ERP-neutral terminology.
