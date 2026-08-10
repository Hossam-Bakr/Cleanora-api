# Bug Report — Email-only OTP race fixture

## Observed behavior

The full integration suite failed one repository test with
`AUTH_VERIFICATION_FAILED` before exercising the intended OTP consumption race.

## Expected behavior

The fixture must represent a valid current-phase email challenge so that a
conditional consume result of zero returns `false` without updating the user or
writing a success event.

## Reproduction

Run `npm run test:integration`. The failing case was
`authentication repository conditional mutations > does not update identity or
write success events when OTP consumption loses a race`.

## Environment

R1-P04A development configuration with Authentication and Email enabled and SMS
disabled.

## Evidence and root cause

The test still constructed an Individual `CATEGORY_VERIFICATION` challenge with
channel `SMS`. DEC-035 makes `EMAIL` the only valid current verification channel,
so production code correctly rejected the stale fixture before `updateMany`
could model the race.

## Fix

Changed only that valid-race fixture to channel `EMAIL`. The separate invalid
stored-enrollment test remains unchanged and continues to prove fail-closed
behavior.

## Regression test

The corrected test asserts that a zero-row conditional consume resolves to
`false`, does not update the identity, and does not append a success event.

## Validation

- Focused repository suite: 1 file, 6 tests passed.
- Full integration suite: 51 files, 146 tests passed.

## Remaining risk

None specific to the fixture repair. Database clean-apply and coverage are
tracked separately as pending phase gates.
