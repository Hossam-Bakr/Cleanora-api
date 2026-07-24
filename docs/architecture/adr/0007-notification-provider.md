# ADR-0007 — Notification provider

- Status: Partially Accepted
- Date: 2026-07-23
- Updated: 2026-07-24

## Context

The canonical vision explicitly requires Firebase push for providers and
workers. Authentication and operational flows also require SMS and email.

## Decision

- Use Firebase Cloud Messaging behind `NotificationPort` for push delivery.
- Keep templates, localization, eligibility, idempotency, delivery attempts,
  retries, and terminal failures server-controlled.
- Keep Nodemailer behind `EmailPort` for email transport.
- SMS remains provider-neutral until an Egypt-appropriate provider is approved.

## Remaining decision

Select the SMS provider and production credentials before R1-P02 OTP delivery
is implemented.
