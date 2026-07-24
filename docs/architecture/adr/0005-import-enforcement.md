# ADR-0005 — Cross-module import enforcement

- Status: Proposed
- Date: 2026-07-23

## Context

Native `#` package imports provide runtime-safe aliases, but TypeScript does not fully prevent relative deep cross-module imports.

## Proposed decision

Use Node package import maps and review rules immediately. During the approved tooling phase, compare ESLint `no-restricted-imports` with dependency-cruiser for automated boundary checks.

## Decision needed

Approve the lint/tooling dependency and its configuration before installation.
