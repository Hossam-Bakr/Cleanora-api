# ADR-0001 — Modular monolith

- Status: Accepted
- Date: 2026-07-23

## Context

Cleanora needs strong domain ownership and operational transactions without distributed-system overhead.

## Decision

Build one Node.js application, one deployable backend, one PostgreSQL database, and isolated in-process business modules.

## Consequences

Modules require explicit public contracts and persistence ownership. Microservice networking and independent deployables are excluded.
