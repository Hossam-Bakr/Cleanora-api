# Feature Specification: Complete Authentication & Identity

**Feature Branch**: `Not created (no before_specify hook configured)`

**Created**: 2026-07-24

**Status**: Draft

**Input**: R1-P02 complete Release 1 authentication and identity journeys, including the human-approved individual-only Google sign-in decision.

## Canonical Sources & Phase Boundary

**Active phase**: `R1-P02 — Complete Authentication & Identity`, confirmed as the only `In Progress` phase by `docs/product/current.md`.

**Goal and Definition of Done**: `docs/product/roadmap.md`, section `R1-P02 — Complete Authentication & Identity`.

**Product authority**:

- Vision section 4 defines one identity system, actor categories, entry points, verification rules, worker login restrictions, and ban/suspension enforcement.
- DEC-011 includes Google sign-in without replacing actor-specific verification.
- DEC-012 requires a standalone repository-local product.
- DEC-014 requires incremental, phase-owned persistence changes.
- DEC-015 resolves OQ-014: Google sign-in is enabled for `INDIVIDUAL` accounts only in Release 1. Other account types remain architecturally extensible but disabled. Google authentication never bypasses phone verification or another required verification gate.
- DEC-017 preserves every production verification rule while allowing unavailable local-development SMS delivery intents to be redirected to one configured developer email inbox for manual runtime acceptance only. The redirect is forbidden in test/production, does not prove phone ownership, exposes no secret through logs/events/errors/API responses, and must be removed before production readiness.
- DEC-018 requires a browser-safe Google flow: one provider-registered backend callback derives SIGN_IN versus LINK from a server-held one-time transaction, redirects only to an allowlisted frontend URI without tokens or provider secrets, and uses authenticated phone request/verification to promote the exact verification-only session.
- DEC-024 supersedes DEC-019: the backend never renders a Google result page and always redirects to the allowlisted frontend callback.
- DEC-027 permits a separately enabled and acknowledged hosted-preview
  SMS-to-email fallback while a real SMS provider is unavailable. It does not
  prove phone ownership and must be replaced before production readiness.
- DEC-020 standardizes descriptive API failures, permits field-specific
  phone/email conflict disclosure only during public signup, and replaces the
  former 12-character password minimum with a 7–128 character
  predictability-based policy.

- DEC-021 requires validation to return every independently detectable issue
  in one response and adopts the explicit `cleanora_refresh_token` and
  `cleanora_google_oauth_state` cookie names while expiring known legacy names.
- DEC-022 aggregates simultaneous public-signup phone and email conflicts into
  one safe issues array; passwords are never duplicate identifiers.

**Dependency**: R1-P01 is Complete with final independent verdict `APPROVED`. R1-P02 reuses its startup, validation, response, request-tracing, logging, configuration, audit, database-lifecycle, testing, and coverage foundations.

**Approved persistence scope**: only `users`, `user_credentials`, `user_sessions`, `otp_codes`, `password_reset_tokens`, `social_accounts`, and `auth_events` may be introduced or changed for R1-P02 authentication persistence. Field-level design, constraints, indexes, migration SQL, and lifecycle details belong to planning.

**Explicit exclusions**:

- No roles, permissions, or privileged authorization behavior.
- No customer, company, engineer, provider, or worker profile implementation.
- No worker self-signup, worker management, invitation workflow, or provider team management.
- No addresses, wallets, payments, catalog, bookings, or later-phase business data.
- No Docker, cloud, deployment, or production migration.
- No future-phase tables or early compatibility models.
- No implementation, dependency installation, migration creation, commit, push, or phase completion during specification.

## Clarifications

### Session 2026-07-24

- Q: When a normalized phone or email already belongs to an identity, may that identity add another R1-P02 account category? → A: Yes. An authenticated identity may add another supported self-signup account category in R1-P02, reusing the same user record and completing the new category’s verification gate; worker enrollment remains prohibited.
- Q: Which recovery channel is authoritative for forgot-password? → A: Individuals and workers recover by SMS to their registered phone; company, engineer, and provider-owner accounts recover through verified email.
- Q: What happens to sessions after an authenticated password change? → A: Revoke all other sessions and immediately rotate the current session.
- Q: Does a newly added pending account category block an identity’s already verified categories? → A: No. Existing verified categories remain usable; only the newly added category is blocked until its verification gate completes.
- Q: What happens to sessions and sign-in state after a successful password reset? → A: Revoke all sessions and require a fresh login with the new password; password reset does not automatically sign in.

### Session 2026-07-26

- Q: What should signup return when the normalized phone or email already
  belongs to an identity? → A: Return a field-specific `409` conflict code,
  safe descriptive message, and field/reason details. This limited signup-only
  existence disclosure is human-approved; login and forgot-password remain
  enumeration-safe and reveal no account details.
- Q: What password policy should signup, reset, and change-password enforce? →
  A: Accept 7–128 characters without composition rules, including numbers-only
  passwords, but reject common, repeated, repeated-pattern, and ascending or
  descending sequential values.

### Session 2026-07-27

- Q: Should invalid phone, email, and password values fail one at a time? →
  A: No. Return all independently detectable request validation issues in one
  `400 REQUEST_VALIDATION_FAILED` response so the frontend can render every
  field error after one submission.
- Q: Which authentication cookie names are canonical? → A:
  `cleanora_refresh_token` is the rotating refresh credential and
  `cleanora_google_oauth_state` is Google OAuth correlation. Expire the known
  stale `cleanora_refresh`, `fs_refreshtoken`, and `cleanora_google_state`
  names; do not accept them under the canonical configuration.
- Q: What happens when both signup phone and email are already registered? →
  A: Return one `409 AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED` response with
  both safe fields in `error.details.issues`. Never compare or report a
  password as duplicated.

### Session 2026-07-28

- Q: How can every signup category be exercised on the hosted preview before a
  real SMS provider is connected? → A: Direct email categories use the
  configured SMTP provider. Individual SMS intents may be redirected to the
  server-resolved account email only when both hosted fallback flags are
  enabled, with an explicit acknowledgement that this does not verify phone
  ownership.

- Q: What should a user enter to complete forgotten-password recovery? →
  A: A four-digit numeric reset code. Forgot-password returns a fresh opaque
  `challengeId` for every valid request, including absent identities, while
  only eligible accounts receive the code out of band. Reset combines
  `challengeId`, `code`, and `newPassword`; the raw code is never persisted,
  remains expiring, single-use, and attempt-limited.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register and Complete the Correct Verification Journey (Priority: P1)

As an individual, company representative, engineer, or provider owner, I need to create the correct account type and complete its required verification so that I enter Cleanora through one identity system without being granted capabilities that belong to later phases.

**Why this priority**: Every later Release 1 journey depends on trustworthy identities and the correct verification gate for each actor type.

**Independent Test**: Exercise each supported self-signup journey and verify required fields, pending status, delivery and validation of the correct one-time code, activation outcome, duplicate-identifier handling, and absence of profile or permission creation.

**Acceptance Scenarios**:

1. **Given** a new individual supplies a valid phone and password, **When** signup succeeds, **Then** the account remains pending until a six-digit SMS code verifies the phone.
2. **Given** an individual supplies an email, **When** phone verification completes, **Then** the account may become active while email verification remains encouraged and non-blocking.
3. **Given** a company or engineer supplies the required phone, email, and password, **When** signup succeeds, **Then** email verification is blocking and phone SMS verification is not required.
4. **Given** a provider owner supplies the required phone, email, and password, **When** signup succeeds, **Then** email verification is blocking and no provider profile or provider-management behavior is created.
5. **Given** an authenticated identity requests another supported self-signup account category, **When** category enrollment succeeds, **Then** the existing user record gains the category in pending state, existing verified categories remain usable, and only the new category is blocked until its verification gate completes, without creating a duplicate identity, role, permission, or profile.
6. **Given** an unauthenticated signup uses an identifier already associated
   with an identity, **When** signup is attempted, **Then** the response
   identifies only the conflicting `phone` or `email` field with a stable
   `409` code, reveals no other account details, and creates no duplicate
   identity or category.
7. **Given** a worker-facing entry point, **When** self-signup or category enrollment is attempted, **Then** the operation is unavailable and no worker identity or category is created.

---

### User Story 2 - Sign In and Maintain a Safe Session (Priority: P1)

As an eligible account holder, I need to sign in with phone and password, receive a short-lived authenticated session, refresh it safely, inspect my current identity, and end one or all sessions.

**Why this priority**: Safe session lifecycle is the foundation for every authenticated Release 1 request.

**Independent Test**: Sign in an eligible account, exercise current-user, refresh rotation, expiry, logout, logout-all, replay of an old refresh credential, and protected-request rejection after revocation.

**Acceptance Scenarios**:

1. **Given** valid credentials and all blocking verification complete, **When** login succeeds, **Then** a short-lived access credential and a refresh-backed session are issued without returning stored secret material.
2. **Given** an identity has no verified category, **When** login is attempted, **Then** access to protected functionality is denied while only the required verification and recovery actions remain available.
3. **Given** an identity has an existing verified category and a newly added pending category, **When** it logs in or continues an authenticated session, **Then** the verified category remains usable and the pending category remains unavailable.
4. **Given** a valid refresh session, **When** it is refreshed, **Then** the prior refresh credential becomes unusable and a replacement is issued for the same session family.
5. **Given** a previously rotated refresh credential is reused, **When** reuse is detected, **Then** the affected session family is revoked and a security event is recorded.
6. **Given** a valid access session, **When** the current-user action is requested, **Then** the response returns the authenticated identity, account categories, account status, and category-specific verification states without credentials or secret values.
7. **Given** a user logs out, **When** the ended session is used again, **Then** refresh and protected-session continuation fail.
8. **Given** a user selects logout-all, **When** any of that identity’s prior sessions are used, **Then** every affected session is rejected.

---

### User Story 3 - Recover and Change a Password Safely (Priority: P1)

As an account holder, I need to recover a forgotten password without account enumeration and change a known password while authenticated so compromised credentials can be replaced safely.

**Why this priority**: Recovery is essential for account continuity and is a common target for abuse.

**Independent Test**: Request recovery for every account category and absent identities, verify the category-specific delivery channel, consume valid, expired, reused, and over-attempted reset credentials, change a password with correct and incorrect current credentials, and confirm previous sessions follow the approved revocation behavior.

**Acceptance Scenarios**:

1. **Given** any syntactically valid recovery identifier, **When** password recovery is requested, **Then** the response is indistinguishable whether or not an account exists.
2. **Given** an individual or worker account exists, **When** recovery is requested, **Then** a single-use expiring four-digit reset code is delivered by SMS to its registered phone without persisting the raw code.
3. **Given** a company, engineer, or provider-owner account with verified email exists, **When** recovery is requested, **Then** a single-use expiring four-digit reset code is delivered through that verified email without persisting the raw code.
4. **Given** a valid challenge ID and unused four-digit reset code, **When** a compliant new password is submitted, **Then** the password changes, the proof is consumed, every session is revoked, no new session is issued, a security event is recorded, and the user must log in with the new password.
5. **Given** an expired, already-used, invalid, or attempt-exhausted recovery challenge/code pair, **When** reset is attempted, **Then** the password remains unchanged and the response reveals no secret or account details.
6. **Given** an authenticated user supplies the correct current password and a compliant new password, **When** change-password succeeds, **Then** the new password replaces the old one, every other session is revoked, and the current session is immediately rotated.

---

### User Story 4 - Use Google Sign-In as an Individual Only (Priority: P1)

As an individual customer, I need to sign in or link my account with Google while still completing Cleanora’s required phone verification.

**Why this priority**: Google sign-in is approved Release 1 scope, but unsafe linking or verification bypass would compromise identity integrity.

**Independent Test**: Exercise new and existing individual Google journeys, authenticated linking, conflicting identifiers, unverified provider identity, non-individual attempts, unlink safety, and the blocking phone-verification gate.

**Acceptance Scenarios**:

1. **Given** a valid Google identity for a new individual, **When** Google authentication succeeds, **Then** an individual identity may be established but remains restricted until required phone verification completes.
2. **Given** an existing verified individual deliberately links Google while authenticated, **When** provider ownership is confirmed, **Then** the social identity is linked without changing required verification state.
3. **Given** an unauthenticated Google identity shares an email with an existing account, **When** safe ownership cannot be established, **Then** the system does not silently merge or link the identities.
4. **Given** a company, engineer, provider owner, or worker attempts Google authentication, **When** the account type is evaluated, **Then** Google authentication is rejected without enabling that audience.
5. **Given** Google authentication succeeds but the individual phone remains unverified, **When** protected functionality is requested, **Then** access remains blocked until phone verification completes.
6. **Given** Google redirects to the backend callback, **When** state, nonce, PKCE, and the one-time transaction are valid, **Then** the backend completes the stored sign-in/link intent and redirects to the allowlisted frontend without placing tokens, authorization codes, state, or provider errors in the URL.
7. **Given** a new Google individual has a verification-only session, **When** that principal requests and correctly verifies a phone OTP, **Then** the challenge must belong to the same user and the exact session is atomically promoted to full access without a second Google sign-in.

---

### User Story 5 - Allow Worker Login Without Worker Self-Signup (Priority: P2)

As a provider-created worker, I need to log in with phone and password while the public authentication surface prevents worker self-registration.

**Why this priority**: Workers require authenticated access in Release 1, but worker ownership and creation belong to provider-managed workflows outside this phase.

**Independent Test**: Establish a pre-provisioned worker identity, verify phone/password login, reject missing or inactive worker identities, and prove every public signup path refuses worker creation.

**Acceptance Scenarios**:

1. **Given** an existing provider-created worker identity in an eligible state, **When** correct phone and password are supplied, **Then** worker login follows the normal secure session lifecycle.
2. **Given** no pre-provisioned worker exists, **When** worker login is attempted, **Then** the response is generic and no identity is created.
3. **Given** any public signup request declares a worker account type, **When** validation occurs, **Then** the request is rejected before persistence.
4. **Given** a worker is suspended or banned, **When** login or an authenticated request is attempted, **Then** access is denied according to account-status rules.

---

### User Story 6 - Resist Authentication Abuse and Enforce Account Status (Priority: P1)

As a user and operator, I need deterministic abuse controls, status enforcement, safe diagnostics, and security-event evidence so authentication attacks do not expose accounts or silently weaken protection.

**Why this priority**: Authentication is a high-risk boundary; abuse controls and evidence are required for trustworthy release operation.

**Independent Test**: Exercise rate limits, consecutive failures, cooldown/reset behavior, OTP and recovery attempt exhaustion, suspended/banned states, redaction, generic responses, and security-event capture using identical inputs and expected outcomes.

**Acceptance Scenarios**:

1. **Given** repeated login, OTP, recovery, refresh, or Google attempts exceed the configured policy, **When** another request arrives in the same policy window, **Then** it is deterministically limited with a safe retry outcome.
2. **Given** consecutive credential failures reach the configured lockout threshold, **When** further login attempts occur, **Then** the account or identifier is temporarily locked according to the documented cooldown and reset rules without exposing account existence.
3. **Given** an account is suspended, **When** login or an authenticated request occurs, **Then** access is denied, active sessions are revoked or rejected, and the temporary status remains distinguishable to authorized internal handling without public detail leakage.
4. **Given** an account is banned, **When** login or an authenticated request occurs, **Then** access is denied until reinstatement by a later authorized workflow, without implementing that workflow here.
5. **Given** authentication data is logged or audited, **When** output is inspected, **Then** passwords, one-time codes, access credentials, refresh credentials, reset credentials, cookies, and secrets are absent or redacted.

### Edge Cases

- Duplicate or differently cased email addresses and differently formatted equivalent phone numbers, including authenticated category enrollment versus unauthenticated signup collisions.
- Concurrent signup attempts for the same normalized identifier.
- OTP resend while an earlier code is active; only the documented active code remains usable.
- OTP delivery succeeds after the request has already expired or been superseded.
- OTP or reset verification reaches the attempt limit exactly, then receives another attempt.
- Multiple concurrent refresh attempts use the same refresh credential.
- A rotated refresh credential is replayed after its replacement has already rotated again.
- Logout races with refresh, current-user, or another protected request.
- Password reset races with an active refresh attempt.
- Password reset changes the password but session revocation cannot complete; the operation must not leave any old session usable or create an automatic recovery session.
- Password change succeeds but current-session rotation or other-session revocation cannot complete; the operation must not leave a partially applied security state.
- An identity lacks its category’s authoritative recovery destination or the destination becomes unavailable; the public response remains generic and no alternate channel is silently substituted.
- Account status changes between access issuance and a protected request.
- A category becomes verified, pending, suspended, or otherwise unavailable while another category on the same identity remains verified.
- A suspended or banned identity has sessions on multiple devices.
- Google provider email is absent, unverified, changed, or conflicts with an existing identity.
- A Google social identity is already linked to another individual.
- An individual attempts to unlink the only remaining safe sign-in method.
- A non-individual account attempts Google sign-in or linking.
- A worker attempts any self-signup path or a non-worker attempts the worker entry point.
- Authentication infrastructure or delivery channels are unavailable; failures remain explicit and do not issue partial credentials.
- Client-supplied return targets or linking state are missing, expired, mismatched, or tampered with.
- Cookies are absent, duplicated, expired, sent on the wrong path, or rejected by secure transport policy.
- Requests contain secret fixtures in nested error or logging contexts.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity and signup

- **FR-001**: The system MUST maintain one identity system in which one user record may hold multiple supported account categories over time without creating separate authentication stacks.
- **FR-002**: The system MUST allow unauthenticated self-signup and authenticated category enrollment only for individual, company, engineer, and provider-owner account categories.
- **FR-003**: The system MUST reject worker self-signup on every public signup path.
- **FR-004**: The system MUST support login for an existing provider-created worker identity without implementing worker creation or management.
- **FR-005**: The system MUST normalize and validate phone and email identifiers consistently before uniqueness checks, lookup, authentication, and rate-limit evaluation.
- **FR-006**: The system MUST prevent duplicate identities for the same normalized authoritative identifier under concurrent requests; an existing identity may gain another supported account category only after authenticating as that identity.
- **FR-007**: The system MUST store passwords only using the approved strong one-way password protection and MUST never store or recover plaintext passwords.
- **FR-008**: Password creation and change MUST enforce one documented password policy consistently across signup, reset, and change-password actions.
- **FR-009**: Signup and category enrollment MUST create only authentication identity/category state and MUST NOT create roles, permissions, actor profiles, provider structures, or later-phase records.

#### Verification and one-time codes

- **FR-010**: Individual signup MUST require phone and blocking six-digit SMS verification before protected access.
- **FR-011**: Individual email MUST be optional; when supplied, email verification MUST be non-blocking for Release 1.
- **FR-012**: Company and engineer signup MUST require phone and email, with blocking email one-time-code verification and no blocking SMS verification.
- **FR-013**: Provider-owner signup MUST require phone and email, with blocking email one-time-code verification and no blocking SMS verification.
- **FR-014**: Google authentication MUST NOT satisfy or bypass an individual’s required phone verification.
- **FR-015**: One-time codes MUST expire, be single-use, have deterministic attempt limits, and become unusable after successful consumption or supersession.
- **FR-016**: Raw one-time codes MUST never be persisted or written to logs, errors, events, or audit context.
- **FR-017**: Resend behavior MUST be deterministic, rate-limited, and prevent multiple ambiguous active codes for the same purpose and identity.
- **FR-018**: Verification outcomes MUST not disclose whether an unrelated account or identifier exists.

#### Login and session lifecycle

- **FR-019**: The system MUST support phone-and-password login for eligible account holders, including pre-provisioned workers.
- **FR-020**: Login MUST deny protected access when an identity has no verified category; when at least one category is verified, existing verified categories remain usable while each pending category remains unavailable until its own gate completes.
- **FR-021**: Successful login MUST issue a short-lived access JWT and establish a refresh-backed session with an explicit absolute expiry.
- **FR-022**: Raw refresh tokens MUST never be persisted; stored session material MUST support secure verification and revocation without recovering the raw token.
- **FR-023**: Every successful refresh MUST rotate the refresh token and invalidate the token just used.
- **FR-024**: Refresh-token reuse MUST revoke the affected session family, reject further family use, and record a security event.
- **FR-025**: Expired, revoked, malformed, mismatched, or otherwise invalid access and refresh credentials MUST fail closed.
- **FR-026**: Logout MUST revoke the current session; logout-all MUST revoke every active session owned by the identity.
- **FR-027**: Current-user MUST return only the authenticated identity’s safe account categories, account status, and category-specific verification states and MUST exclude credentials, token material, and secret metadata.
- **FR-028**: Account status and session revocation MUST be enforced on authenticated requests, not only at initial login.
- **FR-029**: Authentication cookies MUST follow the approved secure, HTTP-only, same-site, scope, and expiry configuration in every environment.
- **FR-030**: Cross-site or untrusted requests MUST NOT be able to use refresh or logout cookie flows outside the approved request-origin protections.

#### Password recovery and change

- **FR-031**: Forgot-password MUST use SMS to the registered phone for individual and worker accounts and verified email for company, engineer, and provider-owner accounts; public responses MUST remain indistinguishable for existing and non-existing accounts when the request is syntactically valid.
- **FR-032**: Raw four-digit password-reset codes MUST never be persisted or logged.
- **FR-033**: Password-reset challenges and codes MUST expire, be single-use, have deterministic attempt limits, and be bound to one identity and purpose. Forgot-password MUST return an opaque challenge ID for every valid request so the response remains enumeration-safe.
- **FR-034**: Successful password reset MUST atomically consume the matching challenge/code proof, replace the password, revoke every session, issue no new session, require a fresh login with the new password, and record a security event; partial success MUST fail closed.
- **FR-035**: Change-password MUST require an authenticated eligible account, correct current password, and a compliant distinct new password.
- **FR-036**: Successful password change MUST atomically replace the password, revoke every other session, rotate the current session, and record a security event; partial success MUST fail closed.

#### Google sign-in and account linking

- **FR-037**: Google sign-in and linking MUST be enabled only for `INDIVIDUAL` accounts in Release 1.
- **FR-038**: Company, engineer, provider-owner, worker, and other account categories MUST remain disabled for Google authentication even though the architecture may support future audiences.
- **FR-039**: A new individual authenticated by Google MUST remain pending until blocking phone verification completes.
- **FR-040**: Linking Google to an existing individual MUST require reliable proof of control of both the Cleanora identity and Google identity.
- **FR-041**: The system MUST NOT automatically merge or link accounts solely because email strings match.
- **FR-042**: Google identities lacking required provider assurance, containing conflicting ownership, or already linked elsewhere MUST fail safely without disclosing another account.
- **FR-043**: Social-account linking and unlinking MUST preserve at least one approved recoverable authentication method and MUST record security events.
- **FR-044**: Google callback state and request correlation MUST be time-bound, single-use, and resistant to tampering and login substitution.

#### Abuse controls, status, and security evidence

- **FR-045**: Login, signup, OTP send/verify, password recovery/reset, refresh, and Google authentication MUST each have a documented deterministic rate-limit policy.
- **FR-046**: Credential failures MUST follow a documented lockout policy defining threshold, evaluation scope, cooldown, reset triggers, and safe retry information.
- **FR-047**: Rate-limit and lockout decisions MUST be based on normalized trusted identifiers and server-observed context and MUST NOT trust spoofable client input as sole authority.
- **FR-048**: A `PENDING_VERIFICATION` category MUST be restricted to the actions required to verify, recover, inspect safe status, or end sessions; it MUST NOT disable another verified category on the same identity.
- **FR-049**: An identity with at least one verified category MAY authenticate subject to credential, session, status, and abuse controls, but only verified categories are usable.
- **FR-050**: `SUSPENDED` accounts MUST be denied login and authenticated requests for the suspension period, with existing sessions rejected or revoked.
- **FR-051**: `BANNED` accounts MUST be denied login and authenticated requests until a later authorized reinstatement action; R1-P02 MUST NOT implement that privileged action.
- **FR-052**: Public authentication responses MUST not reveal whether an account exists, which identifier matched, internal status reasons, credential history, or verification secrets.
- **FR-053**: Security-relevant successes and failures MUST create safe authentication events with identity when known, action, outcome, time, request trace, and non-secret context.
- **FR-054**: Passwords, one-time codes, JWTs, refresh tokens, reset tokens, cookies, provider credentials, and other secrets MUST never appear in logs, error details, authentication events, or audit context.
- **FR-055**: Required authentication security events MUST fail explicitly if evidence cannot be recorded; they MUST NOT be silently discarded.

#### Persistence, ownership, and foundation reuse

- **FR-056**: R1-P02 authentication persistence MUST be limited to `users`, `user_credentials`, `user_sessions`, `otp_codes`, `password_reset_tokens`, `social_accounts`, and `auth_events`.
- **FR-057**: The phase MUST NOT add roles, permissions, actor profiles, worker-management records, addresses, wallets, or future-phase tables.
- **FR-058**: Authentication behavior and persistence access MUST remain owned behind one explicit authentication-module contract; raw persistence details MUST NOT become a cross-module public API.
- **FR-059**: Country-sensitive verification and authentication settings MUST use the existing configuration public contract rather than hard-coded country branches.
- **FR-060**: Required auditable security actions MUST use the existing audit foundation through its public contract without implementing privileged authorization.
- **FR-061**: Authentication responses MUST follow the existing stable success and error conventions and include request-trace identifiers.
- **FR-062**: Environment and startup validation MUST keep authentication secrets required only when their corresponding R1-P02 capability is enabled and MUST fail before serving traffic when enabled capability configuration is invalid.
- **FR-063**: The phase MUST preserve one centralized process-wide database lifecycle for startup, probes, authentication repositories, and shutdown.
- **FR-064**: Persisted security credentials and codes MUST have purpose, creation, expiry, consumption or revocation state, and ownership sufficient to enforce all lifecycle rules unambiguously.
- **FR-065**: The eventual phase migration MUST be incremental, phase-owned, cleanly applicable after R1-P01, limited to approved models, and validated without editing the applied R1-P01 migration.
- **FR-066**: R1-P02 MUST NOT implement Docker, cloud, deployment, production migration, roles, permissions, profiles, worker creation, or later-phase product behavior.

### Key Entities

- **User (`users`)**: The central Cleanora identity, including one or more supported account categories, normalized identifiers, lifecycle status, and category-specific verification state; it does not grant roles or contain actor profiles in this phase.
- **User credential (`user_credentials`)**: Password authentication material and credential lifecycle metadata, never plaintext or reversible password data.
- **User session (`user_sessions`)**: One refresh-backed login session and its rotation family, expiry, revocation, reuse-detection, client context, and last-use evidence without raw refresh tokens.
- **One-time code (`otp_codes`)**: A time-bound, single-use, attempt-limited verification challenge for an approved identity and purpose without storing the raw code.
- **Password reset token (`password_reset_tokens`)**: A time-bound, single-use, attempt-limited recovery challenge bound to one identity without storing the raw four-digit code.
- **Social account (`social_accounts`)**: A verified external identity link; Release 1 enables Google only for individuals while retaining an extensible provider/audience model.
- **Authentication event (`auth_events`)**: Append-oriented, redacted security evidence for authentication actions, outcomes, request trace, and safe context.
- **Session family (derived)**: The related sequence of rotated refresh credentials whose reuse or compromise can be revoked together.
- **Verification gate (derived)**: The actor-specific blocking condition that determines whether an identity may access protected functionality.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of supported signup tests apply the correct verification rule: blocking phone verification for individuals and blocking email verification for company, engineer, and provider-owner accounts.
- **SC-002**: 100% of worker self-signup attempts are rejected before creating an identity, while eligible pre-provisioned worker login cases succeed.
- **SC-003**: Across login and recovery enumeration tests, existing and absent
  accounts produce equivalent public response semantics with zero
  account-specific disclosure. Public signup is the approved exception and
  may identify only a normalized phone/email conflict field.
- **SC-004**: 100% of expired, used, superseded, invalid, or attempt-exhausted one-time codes and reset credentials are rejected without changing protected identity state.
- **SC-005**: 100% of successful refreshes invalidate the prior refresh credential and preserve exactly one valid successor for that rotation path.
- **SC-006**: 100% of detected refresh-token reuse cases revoke the affected session family and prevent subsequent family use.
- **SC-007**: Logout invalidates the selected session and logout-all invalidates all prior sessions in 100% of exercised cases.
- **SC-008**: Current-user responses contain the correct identity, account category, status, and verification state with zero password, code, token, cookie, or secret fields.
- **SC-009**: Google authentication succeeds only for individual accounts in 100% of audience tests; all other account categories remain disabled.
- **SC-010**: Google-authenticated individuals with unverified phones are denied protected access in 100% of verification-bypass tests.
- **SC-011**: Suspended and banned accounts are denied at both login and authenticated-request checks in 100% of exercised status cases.
- **SC-012**: Repeating the same rate-limit or lockout sequence against the same policy state produces the same decision, cooldown, and retry outcome in 100% of policy tests.
- **SC-013**: Logs, errors, authentication events, and audit evidence contain zero clear-text passwords, one-time codes, JWTs, refresh tokens, reset tokens, cookies, provider credentials, or configured secrets across the complete redaction fixture set.
- **SC-014**: Under normal service conditions, at least 95% of valid login, refresh, logout, and current-user actions complete within two seconds, excluding user time and external message delivery.
- **SC-015**: A clean database can apply migrations through R1-P02 with exactly the approved R1-P01 foundations plus the seven approved R1-P02 authentication models and no future-phase tables.
- **SC-016**: Every R1-P02 acceptance journey has reproducible unit or integration evidence, with end-to-end evidence for signup verification, login/session rotation, password recovery, Google verification gating, and status enforcement.
- **SC-017**: Review finds zero implemented roles, permissions, profiles, worker-management actions, addresses, wallets, Docker/cloud work, deployment behavior, or production migration actions.
- **SC-018**: In 100% of account-category enrollment tests, an authenticated identity reuses its existing user record, receives no role/profile records, completes the new category’s verification gate, and cannot add the worker category.
- **SC-019**: In 100% of password-recovery channel tests, individuals and workers use registered-phone SMS, company/engineer/provider-owner accounts use verified email, unavailable accounts remain undisclosed, and no alternate channel is silently selected.
- **SC-020**: In 100% of successful password-change tests, every other session is rejected, the current session receives rotated credentials, and no old current-session refresh credential remains usable.
- **SC-021**: In 100% of multi-category verification tests, adding a pending category leaves existing verified categories usable and blocks only the pending category until its gate completes.
- **SC-022**: In 100% of successful password-reset tests, every prior session is rejected, no session is created by reset, and protected access requires a fresh login with the new password.

## Assumptions

- One Cleanora identity may add multiple supported self-signup account categories during R1-P02 after authenticating, while R1-P02 stores only authentication identity/category state and does not grant permissions or create profiles.
- Phone and email normalization rules, password policy values, credential lifetimes, attempt thresholds, rate-limit windows, and cooldown durations are centrally configurable and will be made explicit during planning; behavior is fail-closed when required configuration is invalid.
- SMS, email, and Google are explicitly documented external capabilities. Provider selection, credentials, and production configuration belong to planning/operations and are not invented in this specification.
- Individuals must complete phone verification even when Google authenticates the external identity; optional individual email verification remains non-blocking.
- Company, engineer, and provider-owner phone numbers are required identifiers but are not SMS-verified in R1-P02.
- Forgot-password uses the account category’s authoritative recovery channel: registered-phone SMS for individuals and workers, and verified email for company, engineer, and provider-owner accounts.
- Authenticated password change keeps the user signed in only through an immediately rotated current session and revokes every other session.
- Verification eligibility is category-specific: a pending newly enrolled category does not downgrade or block another verified category on the same identity.
- Password reset is not a sign-in action: it revokes all sessions and requires a fresh login with the new password.
- Worker creation and provider ownership are preconditions supplied by an authorized later provider workflow; R1-P02 exposes login only and may use controlled fixtures to prove the precondition.
- Account reinstatement, role assignment, permissions, and privileged ban/suspension management belong to later authorization/admin work. R1-P02 only defines and enforces identity status at authentication boundaries.
- Security-event and audit retention periods follow the approved operational data policy when established; R1-P02 must preserve required evidence and must not silently hard-delete it.
- R1-P01 foundations remain the approved baseline and are extended rather than replaced.
