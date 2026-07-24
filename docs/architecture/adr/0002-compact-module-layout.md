# ADR-0002 — Compact module layout

- Status: Accepted
- Date: 2026-07-23

## Context

Early modules should be understandable without premature nested layers.

## Decision

Begin with the compact routes/controller/service/repository/schemas/types/errors/contracts layout. Evolve internally to deeper layers only when complexity justifies it.

## Consequences

Optional files are created only for real behavior. Public contracts remain stable during internal evolution.
