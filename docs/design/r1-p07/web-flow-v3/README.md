# R1-P07 numbered desktop website flow

This directory is the frontend handoff for the numbered **desktop website** screens of **R1-P07 — Worker, Team & Crew Management**.

It adds a consistent blue circular screen number to every functional page while preserving the established Cleanora web UX, Arabic RTL layout, role boundaries, states, and page-level API footer. The earlier `web-ux-v2` package remains unchanged.

## Start here

1. Open [`00-master-screen-order.png`](./00-master-screen-order.png) to see all 15 page references at once without implying one universal linear actor journey.
2. Open [`16-owner-admin-full-flow.png`](./16-owner-admin-full-flow.png) for the Owner/Admin/System journey.
3. Open [`17-invited-worker-supervisor-flow.png`](./17-invited-worker-supervisor-flow.png) for invited user, Worker, and primary Supervisor journeys.
4. Open [`18-user-stories-matrix.png`](./18-user-stories-matrix.png) to map US1-US8 to actors, guards, outcomes, and screen references.
5. Open the page images in numeric order from `01` through `15`.
6. Use [`API_GUIDE_AR.md`](./API_GUIDE_AR.md) for the exact explanation, request example, response example, authorization, concurrency rules, and frontend use of all 25 R1-P07 HTTP operations.
7. Treat the OpenAPI contract as the canonical request/response authority: `specs/R1-P07-worker-team-crew-management/contracts/provider-workforce-api.openapi.yaml`.

## What the number means

The blue number is a **screen catalog and discovery order**, not a claim that every actor follows one linear 15-step wizard.

- The Owner/Admin can move between workers, teams, readiness, and history from the shared navigation.
- The invited user branches from the Owner-only access page into the public invitation page.
- The Worker and Supervisor each receive a restricted role-specific surface after authorization.
- Readiness and history are downstream outcomes that can be revisited after several different commands.

## Numbered screen catalog

| Order | Image | Primary actor | Frontend purpose |
|---:|---|---|---|
| 01 | [`01-workforce-overview.png`](./01-workforce-overview.png) | Owner / Admin | Workforce landing dashboard, counts, active Teams, quick actions, and readiness summary |
| 02 | [`02-workers-list.png`](./02-workers-list.png) | Owner / Admin | Paginated Worker list with separate operational and login-access states |
| 03 | [`03-worker-create-edit.png`](./03-worker-create-edit.png) | Owner / Admin | Create or edit the Provider-managed Worker profile; creation starts as `DRAFT` |
| 04 | [`04-worker-details.png`](./04-worker-details.png) | Authorized manager | Private Worker detail, skills, avatar, Team context, and independent status summary |
| 05 | [`05-worker-access-and-admin.png`](./05-worker-access-and-admin.png) | Exact Owner | Invitation, login-access, and Provider Admin membership controls |
| 06 | [`06-invitation-acceptance-web.png`](./06-invitation-acceptance-web.png) | Invited user | Public pre-login invitation inspection, onboarding, verification, and acceptance |
| 07 | [`07-worker-lifecycle.png`](./07-worker-lifecycle.png) | Owner / Admin | Worker activation, inactivation, reactivation, terminal removal, and impact review |
| 08 | [`08-teams-list-create.png`](./08-teams-list-create.png) | Owner / Admin | Team list, readiness summary, and creation of an empty `DRAFT` Team |
| 09 | [`09-team-details-membership.png`](./09-team-details-membership.png) | Owner / Admin | Team membership, `cleans`, movement conflicts, composition, and primary Supervisor |
| 10 | [`10-final-cleaner-impact-modal.png`](./10-final-cleaner-impact-modal.png) | Owner / Admin | Atomic final-cleaner impact review and explicit allowed-role confirmation |
| 11 | [`11-supervisor-scoped-team.png`](./11-supervisor-scoped-team.png) | Current primary Supervisor | Exact-Team read scope and the only allowed write: existing membership `cleans` |
| 12 | [`12-worker-self-service.png`](./12-worker-self-service.png) | Worker | Read-only self profile, operational context, Team context, and Provider departure |
| 13 | [`13-team-lifecycle.png`](./13-team-lifecycle.png) | Owner / Admin | Team activation, inactivation, reactivation, archive preview, and terminal archive |
| 14 | [`14-workforce-readiness.png`](./14-workforce-readiness.png) | Owner / Admin | Exact `workersReady` rule, qualifying examples, and readiness impact |
| 15 | [`15-workforce-history.png`](./15-workforce-history.png) | Owner / Admin | Immutable privacy-safe Worker and Team history with before/after facts |

## Supporting flow and story boards

| Image | Purpose |
|---|---|
| [`16-owner-admin-full-flow.png`](./16-owner-admin-full-flow.png) | End-to-end Owner/Admin/System flow from Worker draft through invitation, Team operations, impact checks, ending, and rehire |
| [`17-invited-worker-supervisor-flow.png`](./17-invited-worker-supervisor-flow.png) | End-to-end invited-person onboarding, Worker self-service, and primary Supervisor scoped flows |
| [`18-user-stories-matrix.png`](./18-user-stories-matrix.png) | One-page mapping of all eight stories to actors, UI behavior, guards, outcomes, and screen references |

## Actor routes

### Owner / Admin navigation

```text
01 Overview
├─ 02 Workers List
│  ├─ 03 Create / Edit Worker
│  └─ 04 Worker Details
│     ├─ 05 Access & Admin (Owner-only high-risk controls)
│     │  └─ 06 Public invitation branch
│     ├─ 07 Worker Lifecycle
│     └─ 15 Worker History
├─ 08 Teams List / Create
│  └─ 09 Team Details
│     ├─ 10 Final Cleaner Impact
│     ├─ 11 Supervisor-scoped branch
│     ├─ 13 Team Lifecycle
│     └─ 15 Team History
└─ 14 Workforce Readiness
```

### Invited user and Worker route

```text
05 Owner sends or resends invitation
→ 06 Invited user inspects the newest valid link
→ new account or existing Cleanora identity path
→ email verification when required
→ accept invitation
→ 12 Worker self-service
→ optional Provider departure
→ 14 readiness recalculation + 15 immutable history
```

### Primary Supervisor route

```text
09 Owner/Admin assigns an eligible current member as primary Supervisor
→ 11 Supervisor sees only the exact current Team and current member summaries
→ Supervisor may update only `cleans` on an existing current membership
→ final-cleaner impact cannot be confirmed by the Supervisor
→ 10 Owner/Admin review when the protected final-cleaner case applies
→ 14 readiness outcome + 15 history
```

## Page-to-API map

Every functional page already shows its used APIs in the fixed bottom bar. This section repeats the map as searchable text.

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

### 11 — Supervisor-scoped Team

- `GET /api/v1/providers/{providerId}/teams/{teamId}`
- `GET /api/v1/providers/{providerId}/workers/{workerId}`
- `POST /api/v1/providers/{providerId}/teams/{teamId}/membership-commands`

The backend must resolve the Worker detail as the restricted `PRIMARY_SUPERVISOR` view. The only accepted Team write is `UPDATE_CLEANS` for an existing current membership in the Supervisor's exact Team.

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

## Visual implementation invariants

- All functional screens are desktop website mockups at `1536 × 1024`; none is a mobile page.
- Authenticated Provider pages keep the dark-navy sidebar on the right.
- The invitation page is intentionally public and has no authenticated Provider sidebar.
- The screen-order badge stays at the upper-left below the global header and must never overlap page content.
- Cleanora blue is primary; green is success/active; orange is warning; red is destructive; purple is terminal/archive.
- Operational status, login access, invitation status, and Provider Admin membership remain separate UI concepts.
- The full operational phone must not appear in lists, history, logs, or customer-facing representations.
- High-risk commands require an impact/review state rather than a generic browser confirmation.
- API footers are implementation aids. The OpenAPI contract remains authoritative if an image and contract ever differ.

## Generation and preservation

- The 15 page images were produced as precise ImageGen edits of the accepted `web-ux-v2` desktop screens, adding only the circular order marker as the intended visual change.
- The master order board was generated as a separate ImageGen infographic with a strict 5 × 3 card grid. A final precise edit removed generated connector arrows so the board cannot imply an inaccurate universal route; the authoritative actor flows are the separate `16` and `17` boards and the text routes above.
- The accepted `16`, `17`, and `18` supporting boards were copied unchanged from `web-ux-v2` into this self-contained handoff.
- The original `docs/design/r1-p07/web-ux-v2/` package was not overwritten or deleted.
- The first generated master-board attempt was rejected and not copied into this directory because it duplicated and omitted screen numbers.
- The accepted prompt set is preserved in [`IMAGEGEN_PROMPTS.md`](./IMAGEGEN_PROMPTS.md).
