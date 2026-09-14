# HTTP API — R1-P17 Worker & Team Assignment

Base: `/api/v1`. Auth: session bearer as elsewhere. Idempotency-Key required
on all POSTs below.

## Provider assignment writes

### POST `/providers/:providerId/bookings/:bookingId/assignments/team`

Assign Browse-selected team (`booking.teamId` only — EX-01).
Body: `{ "expectedBookingVersion": number, "teamId": string }`
Pre: status ACCEPTED (first) or used via replace path when ASSIGNED.
Success: assignment summary + booking status ASSIGNED + new version.

### POST `/providers/:providerId/bookings/:bookingId/assignments/workers`

Body: `{ "expectedBookingVersion": number, "workerIds": string[] }`
Same status rules as team assign.

### POST `/providers/:providerId/bookings/:bookingId/assignments/team/replace`

Requires existing ACTIVE assignment; status ASSIGNED.
Body same as assign-team.

### POST `/providers/:providerId/bookings/:bookingId/assignments/workers/replace`

Requires existing ACTIVE assignment; status ASSIGNED.
Body same as assign-workers.

## Reads

### GET `/providers/:providerId/bookings/:bookingId/assignments/current`

Current ACTIVE assignment or 404-shaped empty per API standard.

### GET `/providers/:providerId/bookings/:bookingId/assignments/history`

Ordered history entries.

### GET `/workers/me/assignments`

Caller's ACTIVE assignment memberships (safe booking projection).

### Dossier extensions

Existing GET provider/customer/staff booking dossier includes
`assignment` summary when present.

## Errors (stable codes — indicative)

- `BOOKING_ASSIGNMENT_FORBIDDEN`
- `BOOKING_ASSIGNMENT_INVALID_STATE`
- `BOOKING_ASSIGNMENT_TEAM_MISMATCH` (EX-01)
- `BOOKING_ASSIGNMENT_CREW_MISMATCH`
- `BOOKING_ASSIGNMENT_ESCORT_CANNOT_CLEAN`
- `BOOKING_ASSIGNMENT_COMPOSITION_INVALID`
- `BOOKING_ASSIGNMENT_SCHEDULE_UNAVAILABLE`
- `BOOKING_ASSIGNMENT_WORKER_CONFLICT`
- `BOOKING_ASSIGNMENT_VERSION_CONFLICT`
- `BOOKING_ASSIGNMENT_IDEMPOTENCY_CONFLICT`
