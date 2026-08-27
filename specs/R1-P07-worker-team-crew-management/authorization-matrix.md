# R1-P07 Authorization and Privacy Matrix

Authorization is deny-by-default and evaluated against the trusted principal,
active exact-Provider membership, Worker identity, current Team membership,
current primary-Supervisor assignment, account/access status, target state, and
exact expected versions. A global role never substitutes for exact Provider or
Team scope.

Legend: **A** allowed, **S** self/current-Team scoped, **D** denied.

## Management operations

| Operation | Owner | Explicit Admin | Primary Supervisor | Worker self | Other Worker / Customer / cross-Provider |
|---|:---:|:---:|:---:|:---:|:---:|
| List all Provider Workers/Teams | A | A | S (current Team/current members only) | D | D |
| Read one Worker profile | A | A | S (current member summary) | S (own full self DTO) | D |
| Create Worker Profile | A | A | D | D | D |
| Edit Worker profile/type/skills/avatar/capability | A | A | D | D | D |
| Issue/resend/reset Worker invitation/access | A | D | D | D | D |
| Revoke Worker access | A | D | D | D | D |
| Activate/deactivate/reactivate Worker | A | A | D | D | D |
| Remove Worker | A | D | D | D | D |
| Leave Provider | D | D | D | S | D |
| Grant/revoke Admin membership | A | D | D | D | D |
| Create/edit Team name | A | A | D | D | D |
| Activate/deactivate/archive Team | A | A | D | D | D |
| Add/remove/move Team member | A | A | D | D | D |
| Update existing membership `cleans` | A | A | S (own current Team only) | D | D |
| Confirm final-cleaner impact | A | A | D | D | D |
| Assign/clear primary Supervisor | A | A | D | D | D |
| Read safe Worker/Team history | A | A | D | S only where self history surface is explicitly returned | D |
| Read `workersReady` | A | A | D | D | D |

Primary Supervisor **S** does not include any operational-notes field. The only
write is `cleans` on an existing current membership. If that write would remove
the final valid cleaner from an `ACTIVE` Team, it returns a safe conflict and
directs the actor to Owner/Admin.

## Full operational-phone disclosure

| Recipient/surface | Full phone | Rule |
|---|:---:|---|
| Exact active Owner | Yes | Provider-scoped private DTO; no-store |
| Exact explicit active Admin | Yes | Provider-scoped private DTO; no-store |
| Exact Worker self | Yes | Trusted identity resolves current own engagement; no-store |
| Valid current primary Supervisor | Yes, scoped | Target must be a current member of the Team currently supervised at read time |
| Primary Supervisor after assignment loss | No | Scope disappears immediately |
| Ordinary colleague Worker | No surface | No colleague-profile endpoint/DTO |
| Customer/public/Booking-safe reader | No | Property absent, not masked/full |
| Generic list/history/audit/error/log/outbox | No | Property prohibited |

The phone is not copied to Authentication and acceptance does not verify the
Authentication phone.

## High-risk recent authentication

Maximum proof age is 10 minutes. Proof is bound to actor, session, purpose,
Provider, Worker, request, and one-use consumption.

| Command | Owner | Admin | Step-up |
|---|:---:|:---:|---|
| Issue/reset login access | A | D | Required |
| Revoke login access | A | D | Required |
| Grant/revoke Admin | A | D | Required |
| Remove Worker | A | D | Required |
| Routine profile/skills/avatar | A | A | Not required |
| Worker activate/deactivate/reactivate | A | A | Not required unless combined with another high-risk action |
| Team/name/membership/Supervisor edits | A | A | Not required |
| Worker self-leave | S | D | Authenticated self command; no separate 10-minute step-up approved |

An expired, wrong-purpose, wrong-target, wrong-session, already-consumed, or
stale proof yields `WORKFORCE_REAUTHENTICATION_REQUIRED` with no accepted effect.

## Reason authorization

| Action | Accepted codes | Note rule |
|---|---|---|
| Worker deactivation | `TEMPORARILY_UNAVAILABLE`, `SCHEDULE_OR_LEAVE`, `PERFORMANCE_OR_POLICY`, `PROVIDER_OPERATIONAL_CHANGE`, `OTHER` | Required only for `OTHER`, min 10 meaningful chars |
| Worker removal | `ENGAGEMENT_ENDED`, `PERFORMANCE_OR_POLICY`, `DUPLICATE_OR_INCORRECT_RECORD`, `OTHER` | Always required, min 10 meaningful chars |
| Access revocation | `SECURITY_CONCERN`, `ACCESS_NO_LONGER_REQUIRED`, `ENGAGEMENT_ENDED`, `OTHER` | Required only for `OTHER` |
| Admin grant | `OPERATIONAL_RESPONSIBILITY`, `COVERAGE_OR_BACKUP`, `OTHER` | Required only for `OTHER` |
| Admin revocation | `RESPONSIBILITY_ENDED`, `SECURITY_CONCERN`, `ENGAGEMENT_ENDED`, `OTHER` | Required only for `OTHER` |

A code from another row is invalid even if the string is known globally.
Routine profile/title/phone/skill/avatar/Team-membership edits have no reason.

## Invitation surfaces

| Surface | Principal | Returned data |
|---|---|---|
| Inspect | Anonymous bearer proof | Safe Provider/Worker invitation summary, masked email, locale, expiry, allowed next action; no identity existence detail |
| Onboarding start | Valid latest proof, no existing identity | Authentication-owned password/OTP flow with fixed invitation email |
| Verify email | Restricted onboarding state | Restricted principal allowed only to accept/cleanup |
| Accept existing user | Full authenticated user + latest proof | Exact identity link only when fixed invitation email/account rules pass |
| Accept new user | Restricted onboarding principal + latest proof | Exact identity link after email verification |

Bearer proof, password, OTP, access/refresh tokens, and cookies are write-only,
redacted at request logging, never returned in errors, and never persisted by
Providers.

## Primary-Supervisor eligibility

Assignment requires all at commit time:

1. same Provider as Team;
2. Worker engagement `ACTIVE`;
3. current membership in that exact Team;
4. `supervisorCapable=true`.

Login access remains a separate lifecycle. A person must of course be able to
authenticate to exercise Supervisor HTTP authority, but login-access state is
not an additional product condition for storing an otherwise valid primary-
Supervisor assignment.

Loss of lifecycle, membership, or capability clears the assignment atomically.
Team remains `ACTIVE` only when a separate valid cleaner remains. Being primary
Supervisor does not grant Admin authority and does not change `workerType`.

## Audit and denial evidence

Accepted privileged writes require transaction-bound audit with actor, exact
Provider/target/version, safe action/transition, reason/note where required,
request ID, timestamp, and safe before/after facts. Denials are attributable but
must not reveal private resource existence. Evidence excludes phone, invitation
email/proof, credential/session/OTP/password, media key, and SMTP body.
