# Data model: R1-P18

## Enums

```text
OrderStatus:
  ASSIGNED | ON_THE_WAY | IN_PROGRESS | READY_TO_COMPLETE | COMPLETED | CANCELLED

OrderMediaKind:
  PROGRESS | COMPLETION

CompletionCodeStatus:
  ACTIVE | SUPERSEDED | CONSUMED

OrderEventType:
  CREATED | STATUS_CHANGED | CODE_ISSUED | CODE_RESENT | CODE_ATTEMPT
  | MEDIA_ATTACHED | NOTE_ADDED | CANCELLED

OrderNotificationTemplateKey:
  ORDER_ON_THE_WAY | ORDER_READY_TO_COMPLETE | ORDER_COMPLETED
```

## Tables

### orders
- id (cuid)
- bookingId (unique)
- providerId, customerUserId (logical refs)
- status (OrderStatus)
- assignedAt, onTheWayAt, inProgressAt, readyToCompleteAt, completedAt,
  cancelledAt (nullable timestamptz)
- createdAt, updatedAt
- indexes: status, providerId, customerUserId

### order_status_history
- id, orderId, fromStatus, toStatus, actorUserId, actorRole, reasonCode?
- metadata Json?, createdAt
- index: orderId + createdAt

### completion_codes
- id, orderId
- codeHash, codeSalt
- status (CompletionCodeStatus)
- expiresAt, maxAttempts, attemptsUsed
- issuedAt, consumedAt?
- supersedesCodeId?
- index: orderId; partial unique ACTIVE per order

### completion_code_attempts
- id, completionCodeId, orderId
- actorUserId, success (bool), createdAt
- index: completionCodeId + createdAt

### order_media
- id, orderId, mediaFileId, kind (OrderMediaKind)
- uploadedByUserId, createdAt
- unique: orderId + mediaFileId
- index: orderId + kind

### order_notes
- id, orderId, body (text, length-limited)
- authorUserId, createdAt
- index: orderId + createdAt

### order_events
- id, orderId, type (OrderEventType)
- actorUserId?, payload Json (safe), createdAt
- index: orderId + createdAt

### order_notification_intents (phase-owned)
- id, orderId, templateKey, recipientUserId
- payload Json (may include code plaintext only here, never in GET APIs)
- createdAt, deliveryStatus PENDING (no send)

### order_actor_commands (optional idempotency)
- id, orderId, actorUserId, commandType, idempotencyKey
- requestHash, responseJson, createdAt
- unique: orderId + actorUserId + commandType + idempotencyKey

## Booking coordination

BookingStatus unchanged. On booking CANCELLED, Orders sets non-terminal
order → CANCELLED.
