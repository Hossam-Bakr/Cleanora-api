# R1-P07 Desktop Web UX handoff

This directory is the consistent desktop-web UX reference for **R1-P07 — Worker, Team & Crew Management**.

The package is intended to let the frontend team see the complete page structure, role boundaries, state transitions, warning/confirmation patterns, and API surface before implementing the UI.

The companion Arabic operation-by-operation implementation reference is [`API_GUIDE_AR.md`](./API_GUIDE_AR.md). It covers all 25 R1-P07 HTTP operations with exact request fields, success examples, authorization notes, concurrency/version guidance, and page usage.

## Authority and usage

- The UX images are implementation references, not replacements for the feature contract.
- Canonical behavior remains in `specs/R1-P07-worker-team-crew-management/spec.md`.
- Canonical request/response shapes remain in `specs/R1-P07-worker-team-crew-management/contracts/provider-workforce-api.openapi.yaml`.
- Names, IDs, dates, counts, and phone values in the images are illustrative sample data.
- API paths, lifecycle enums, role boundaries, and the core guards represented below are derived from the current R1-P07 specification and OpenAPI contract.
- All product-management screens are **desktop website screens** at 1536 × 1024. There are no mobile or phone mockups.
- The invitation-acceptance screen is intentionally a public pre-login desktop page without the authenticated Provider sidebar, while retaining the same Cleanora visual language.

## Shared design system

All screens use the visual system established in `00-web-ux-design-system.png`:

- Arabic RTL layout with a 72 px top header.
- Authenticated Provider pages use a fixed dark-navy sidebar on the right.
- Main content uses a light neutral background, white cards, restrained shadows, and a consistent grid.
- Cleanora blue is used for primary actions and selected navigation.
- Green is used for accepted/ready/active states.
- Orange is used for warnings, expiring invitations, and impact review.
- Red is used for destructive or terminal actions.
- Purple or muted gray is used for archived or historical states.
- Every functional page contains a fixed API reference bar at the bottom.
- High-risk actions use a review/impact step before the final confirmation.
- Contract vocabulary such as `DRAFT`, `ACTIVE`, `INACTIVE`, `REMOVED`, `ARCHIVED`, `CLEANING_STAFF`, `ESCORT`, `OTHER`, `cleans`, `workersReady`, `Owner`, `Admin`, and `Primary Supervisor` is intentionally retained where it improves implementation precision.

## Image catalog

| # | File | Frontend purpose | Primary stories |
|---:|---|---|---|
| 00 | `00-web-ux-design-system.png` | Canonical desktop shell, components, tokens, sidebar, cards, tables, statuses, and API footer | Shared |
| 01 | `01-workforce-overview.png` | Provider workforce dashboard with worker, Team, invitation, and readiness summaries | US1-US8 |
| 02 | `02-workers-list.png` | Cursor-paginated Worker list with safe list fields and separate operational/access states | US1, US3, US6, US7 |
| 03 | `03-worker-create-edit.png` | Contract-accurate create/edit form; creates a `DRAFT` without an account or invitation | US1, US7 |
| 04 | `04-worker-details.png` | Private management view of the Worker profile, Team, skills, avatar, and independent state summary | US1, US3, US6, US7 |
| 05 | `05-worker-access-and-admin.png` | Owner-only invitation, login-access, and Provider Admin controls with recent-auth checks | US1-US3, US6 |
| 06 | `06-invitation-acceptance-web.png` | Public desktop invitation wizard for new and existing Cleanora identities | US2 |
| 07 | `07-worker-lifecycle.png` | Worker operational lifecycle, reason controls, removal, impact preview, and terminal rehire rule | US3, US5, US8 |
| 08 | `08-teams-list-create.png` | Cursor-paginated Team listing, status summaries, and creation of an empty `DRAFT` Team | US4 |
| 09 | `09-team-details-membership.png` | Team detail, membership commands, `cleans`, current-Team conflict, composition, and primary Supervisor | US4, US7 |
| 10 | `10-final-cleaner-impact-modal.png` | Atomic last-cleaner warning and Owner/Admin confirmation; Supervisor conflict rule | US5 |
| 11 | `11-supervisor-scoped-team.png` | Primary Supervisor's exact-Team read scope and only allowed write: existing membership `cleans` | US5, US6 |
| 12 | `12-worker-self-service.png` | Worker's read-only self view and Provider-departure flow | US6, US8 |
| 13 | `13-team-lifecycle.png` | Team lifecycle, activation invariants, archive preview, and terminal history | US4 |
| 14 | `14-workforce-readiness.png` | Exact `workersReady` rule, qualifying/non-qualifying examples, and last-qualifying-Worker impact | US5, US7 |
| 15 | `15-workforce-history.png` | Immutable privacy-safe Worker/Team history with safe before/after facts | US3-US5, US8 |
| 16 | `16-owner-admin-full-flow.png` | End-to-end Owner/Admin/System flow from draft Worker through Team operations, impact checks, ending, and rehire | US1-US8 |
| 17 | `17-invited-worker-supervisor-flow.png` | End-to-end invited-person, Worker self-service, and Primary Supervisor scoped flows | US2, US5, US6, US8 |
| 18 | `18-user-stories-matrix.png` | One-page mapping of all eight stories to actors, UI behavior, guards, outcomes, and screen references | US1-US8 |

## Page-to-API map

The API bars in the images use the public `/api/v1` prefix. The exact HTTP schemas, errors, and response envelopes remain defined by the OpenAPI contract.

### 01 — Workforce overview

- `GET /api/v1/providers/{providerId}/workers`
- `GET /api/v1/providers/{providerId}/teams`
- `GET /api/v1/providers/{providerId}/workforce-readiness`

### 02 — Workers list

- `GET /api/v1/providers/{providerId}/workers`
- `POST /api/v1/providers/{providerId}/workers`

### 03 — Worker create/edit

- `POST /api/v1/providers/{providerId}/workers`
- `PUT /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/avatar`
- `DELETE /api/v1/providers/{providerId}/workers/{workerId}/avatar`

### 04 — Worker details

- `GET /api/v1/providers/{providerId}/workers/{workerId}`
- `PUT /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/avatar`
- `DELETE /api/v1/providers/{providerId}/workers/{workerId}/avatar`

### 05 — Worker access and Admin membership

- `GET /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/login-access-commands`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/admin-membership-commands`

### 06 — Invitation acceptance

- `POST /api/v1/worker-invitations/inspect`
- `POST /api/v1/worker-invitations/onboarding/start`
- `POST /api/v1/worker-invitations/onboarding/verify-email`
- `POST /api/v1/worker-invitations/accept`

### 07 — Worker lifecycle

- `GET /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/lifecycle-commands`
- `GET /api/v1/providers/{providerId}/workforce-readiness`
- `GET /api/v1/providers/{providerId}/workers/{workerId}/history`

### 08 — Teams list/create

- `GET /api/v1/providers/{providerId}/teams`
- `POST /api/v1/providers/{providerId}/teams`
- `GET /api/v1/providers/{providerId}/workforce-readiness`

### 09 — Team details and membership

- `GET /api/v1/providers/{providerId}/teams/{teamId}`
- `PUT /api/v1/providers/{providerId}/teams/{teamId}`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/supervisor-commands`

### 10 — Final-cleaner impact

- `POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/lifecycle-commands`
- `GET /api/v1/providers/{providerId}/workforce-readiness`
- `GET /api/v1/providers/{providerId}/teams/{teamId}/history`

### 11 — Supervisor scoped Team

- `GET /api/v1/providers/{providerId}/teams/{teamId}`
- `GET /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands`

The backend scope determines that the Worker detail response is the restricted `PRIMARY_SUPERVISOR` view and that the only accepted Team write is `UPDATE_CLEANS` for an existing current membership in the Supervisor's exact Team.

### 12 — Worker self-service

- `GET /api/v1/workers/me`
- `POST /api/v1/workers/me/leave`

### 13 — Team lifecycle

- `GET /api/v1/providers/{providerId}/teams/{teamId}`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/lifecycle-commands`
- `GET /api/v1/providers/{providerId}/teams/{teamId}/history`

### 14 — Workforce readiness

- `GET /api/v1/providers/{providerId}/workforce-readiness`
- `GET /api/v1/providers/{providerId}/workers`
- `GET /api/v1/providers/{providerId}/workers/{workerId}`

### 15 — Workforce history

- `GET /api/v1/providers/{providerId}/workers/{workerId}/history`
- `GET /api/v1/providers/{providerId}/teams/{teamId}/history`

### 16 — Owner/Admin full flow

- `POST /api/v1/providers/{providerId}/workers`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/login-access-commands`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/lifecycle-commands`
- `POST /api/v1/providers/{providerId}/workers/{workerId}/admin-membership-commands`
- `POST /api/v1/providers/{providerId}/teams`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/lifecycle-commands`
- `GET /api/v1/providers/{providerId}/workforce-readiness`

### 17 — Invited person, Worker, and Supervisor flows

- `POST /api/v1/worker-invitations/inspect`
- `POST /api/v1/worker-invitations/onboarding/start`
- `POST /api/v1/worker-invitations/onboarding/verify-email`
- `POST /api/v1/worker-invitations/accept`
- `GET /api/v1/workers/me`
- `POST /api/v1/workers/me/leave`
- `GET /api/v1/providers/{providerId}/teams/{teamId}`
- `GET /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands`

### 18 — User-story matrix

This is a navigation and coverage board rather than a single runtime page. Its footer intentionally shows API families instead of a misleading single HTTP method:

- `/api/v1/providers/{providerId}/workers...`
- `/api/v1/providers/{providerId}/teams...`
- `/api/v1/providers/{providerId}/workforce-readiness`
- `/api/v1/workers/me...`
- `/api/v1/worker-invitations...`

## Role-specific frontend surfaces

| Actor | May see/do | Must not expose or offer |
|---|---|---|
| Exact Provider Owner | Full Provider workforce; invite/resend/reset/revoke access; grant/revoke Provider Admin; remove Worker; all ordinary Worker/Team operations | Cross-Provider data; unsafe confirmation without recent authentication where required |
| Explicit active Provider Admin | Manage Worker profiles, skills, avatars, ordinary Worker lifecycle, Teams, memberships, Team lifecycle, and primary Supervisor | Worker invitation/access controls, Admin grant/revoke, Worker removal, ownership controls |
| Current primary Supervisor | Read the exact current Team and current-member summaries; read full operational phone for those exact members; update only existing membership `cleans` | Other Teams; add/remove/move members; profile/skill/lifecycle/invitation/access/Admin/Team/Supervisor management; final-cleaner confirmation; operational notes |
| Worker | Read only their own profile, full operational phone, skills, operational context, and Team context; leave the current Provider | Editing Provider-managed data or authority; viewing another Worker; Provider-management actions |
| Invited person | Inspect the latest valid invitation, follow the correct new/existing-account path, review operational phone, and accept | Provider navigation or data before acceptance; another Provider's identity or private conflict details |

## State and guard reference

- Worker operational lifecycle: `DRAFT → ACTIVE ↔ INACTIVE → REMOVED`.
- `REMOVED` is terminal. Rehire creates a new engagement linked to the predecessor.
- Login access: `INVITED`, `ACTIVE`, `EXPIRED`, `REVOKED`; it is separate from Worker operational state.
- Invitation state: `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`, `SUPERSEDED`.
- Each invitation version expires after 72 hours; resend invalidates all earlier links.
- Team lifecycle: `DRAFT → ACTIVE ↔ INACTIVE → ARCHIVED`.
- `ARCHIVED` is terminal.
- Team activation requires a normalized unique name and at least one current `ACTIVE` `CLEANING_STAFF` member whose membership has `cleans=true`.
- A Worker has at most one current Team membership.
- A Team has at most one primary Supervisor, who must be an eligible active current member with `supervisorCapable=true`.
- `cleans` belongs to Team membership, not to the Worker profile.
- `ESCORT` is always represented as a Worker but cannot have `cleans=true` and never satisfies cleaning readiness.
- `workersReady=true` requires at least one Worker with `ACTIVE` operational status, `CLEANING_STAFF`, a complete required profile, a linked Authentication account, the Worker role, and active login access.
- Team membership is not required for `workersReady`.
- Losing the final valid Team cleaner or final readiness-qualifying Worker requires an exact impact preview and explicit allowed-role confirmation.
- Accepted final-cleaner changes update the Worker or membership, Team, readiness, and history atomically. Cancellation or conflict changes nothing.
- Commands use expected versions and idempotency. Stale or competing commands fail safely without partial state.
- History and generic surfaces must not contain full phone, invitation email/proof, password, OTP, cookie, token, or avatar storage key.

## Frontend implementation notes

- Keep operational status, login access, invitation status, and Provider Admin membership as visibly separate UI concepts.
- Do not add Worker email to the create/edit profile form. Invitation email is entered only in the Owner-only invitation flow.
- Do not add Team, region, shift, attendance, payroll, booking, schedule, or operational-note fields to the Worker profile.
- Do not expose operational phone in Worker list items, Team member lists, history, logs, or customer-facing representations.
- Full operational phone is allowed only in the authorized Worker detail/self/current-primary-Supervisor contexts.
- Treat impact confirmation as a dedicated review state, not a generic browser confirmation.
- Keep reason catalogs action-specific. A meaningful note of at least 10 characters is required for every Worker removal and whenever the accepted reason is `OTHER`.
- Owner-only high-risk actions require recent authentication no older than 10 minutes.
- Notification-delivery status is not business truth; a delivery failure must not visually roll back an already accepted command.
- Render server conflicts as safe outcomes without revealing whether another Provider's private Worker or engagement exists.

## Draft archive

The earlier inconsistent image set was preserved, not deleted, under `docs/design/r1-p07/draft-v1/`. It is superseded by this `web-ux-v2` package and should not be used for frontend implementation.
