# Bug Report — Authentication static-quality findings

## Observed behavior

VS Code reported 19 SonarQube and spelling findings across the authentication
service, controller, router, schemas, server composition, and application
documentation comments.

## Expected behavior

The authentication implementation should keep the same public behavior while
using explicit control flow, safe scalar conversion, maintainable dependency
objects, current Zod APIs, and shallow shutdown composition.

## Reproduction

Open the affected TypeScript files with the SonarQube for IDE and Code Spell
Checker extensions enabled. The reported rules were S6582, S2681, S6551,
S107, S3735, S1874, and S2004.

## Environment

- Node.js 24-compatible Cleanora backend
- TypeScript 6
- Express 5
- Zod 4
- Active phase R1-P02

## Evidence and root cause

- Null-first predicates duplicated property access instead of using optional
  chaining.
- Several compact controller handlers omitted braces around conditional throws.
- Query and rate-limit values used generic object stringification.
- The router factory accepted nine positional parameters.
- The logout route discarded a middleware return value with `void`.
- The schema referenced the deprecated `ZodIssueCode` enum.
- The graceful-shutdown timeout nested an additional callback level.
- `Cleanora` was not registered in the workspace spelling dictionary.

## Fix

The predicates now use fail-closed optional chaining. Controller conditionals
use explicit blocks, callback state accepts strings only, rate-limit subjects
use a safe scalar converter, router dependencies use one typed object, logout
delegates without `void`, Zod uses the current literal issue code, shutdown
timeout creation is extracted, and the product name is registered with cSpell.

## Regression test

The controller suite now proves that an object-valued Google callback state is
rejected without coercion. Existing authentication, session-policy,
router-latency, environment, and graceful-shutdown tests cover the remaining
behavior-preserving changes.

## Validation

Focused validation passed: 18 test files and 78 tests, TypeScript typecheck,
changed-file ESLint, production build, static source-pattern checks, and
relevant diff checks.

## Remaining risk

The IDE owns the final visual refresh of its SonarQube problem list. No public
API, database schema, migration, or production configuration changed.
