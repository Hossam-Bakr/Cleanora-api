# Logging Standard

Morgan is the only HTTP access logger:

- development: concise method, safe path, status, duration, request ID
- production: combined-style access line using the safe path
- test: silent

HTTP logs exclude query strings, bodies, authorization headers, cookies,
passwords, tokens, OTPs, secrets, signatures, and payment payloads.

A small JSON application logger handles startup, shutdown, provider failures,
and safe lifecycle events. Its context is recursively redacted. Business
modules depend only on the small `Logger` shape and never on Morgan.
