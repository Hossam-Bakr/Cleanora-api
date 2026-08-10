# Research: R1-P04A

## Email-only current phase

DEC-035 resolves the provider uncertainty: no SMS provider is selected or
implemented now. All supported categories use the existing email OTP flow.
Phone values are stored but unverified. Enabling SMS fails startup instead of
leaving signup to fail after persistence.

## Future verification direction

The intended Individual phone activation, 15-day email grace, and later
Company/Engineer phone verification are product direction only. Deferring the
provider, schema, endpoints, and assurance transitions avoids committing to an
unselected vendor or shipping dormant future-phase behavior.

## Atomic profile creation

Authentication remains transaction owner because identity, credential, and
challenge are Authentication state. Customers supplies a narrow writer bound to
the caller's Prisma transaction, preserving modular ownership while ensuring a
customer never activates without a matching profile.

## Company regulatory values

Commercial and tax registration numbers are optional private account-completion
fields. Nullable columns preserve existing rows and avoid inventing government
claims. No document upload or external validation is included.
