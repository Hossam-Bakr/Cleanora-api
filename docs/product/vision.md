# Cleanora — Product Vision & Locked Business Rules

| Field | Value |
|---|---|
| Product | Cleanora |
| Launch Country | Egypt (`EG`) |
| Architecture | Multi-country ready |
| Product Surface | Responsive web first |
| Status | Canonical implementation vision |
| Derived From | BRD, Business Logic Handoff, Complete Product Spec, User Stories |
| Delivery Plan | See `roadmap.md` |
| Approved Overrides | See `decision-log.md` |
| Unresolved Rules | See `open-questions.md` |

---

## 1. Purpose of this document

This file consolidates Bassam's four product documents into one implementation-facing vision.

It defines **what Cleanora is and how the business behaves**. It does not decide the coding order. Release timing and technical sequencing belong to `roadmap.md` and `decision-log.md`.

Rules marked as locked must not be changed by implementation convenience. Open product details must not be invented.

---

## 1.1 Standalone project boundary

Cleanora is a greenfield standalone product.

Its repository, database, Prisma schema, migrations, modules, APIs, tests, and deployment configuration are created for Cleanora itself. The product does not depend on access to a previous codebase or database.

The approved product documents are business inputs only. They do not imply technical inheritance from another application.

---

## 2. Product vision

Cleanora is a controlled multi-sided marketplace for home cleaning and housekeeping services.

It connects:

- Consumers: individual, company/compound, and engineer accounts
- Service providers: businesses, teams, workers, supervisors, and provider administrators
- Marketers: affiliates who refer customers
- Cleanora staff: admin, operations, support, and finance

The platform must be easy for a customer to use while remaining operationally controlled. The server is the source of truth for price, eligibility, payments, status transitions, and financial records.

---

## 3. Booking models

Cleanora supports two booking paths.

### 3.1 Browse

The customer selects a service, date, location, crew preference, and provider/team from an eligible list.

The customer then creates a booking and pays the configured deposit before confirmation.

### 3.2 Recommended

The customer creates a request with a target price or permitted range. Eligible providers receive the request in real time and may accept, reject, or counteroffer. The customer selects one offer and pays the required deposit before final confirmation.

Recommended is part of the product vision but is delivered later according to `decision-log.md`.

### 3.3 Shared eligibility

Browse and Recommended must use one backend eligibility domain, not separate frontend filtering logic.

Eligibility considers, according to the active release:

- Service offered and valid price
- Provider verification and live status
- Coverage area
- Date and availability
- Worker/team capacity
- Crew gender preference
- Performance gates
- Geographic radius and distance when maps are enabled

Premium status may affect sorting, but must not bypass eligibility.

---

## 4. Identity and actors

### 4.1 System roles

- `CUSTOMER`
- `PROVIDER_OWNER`
- `WORKER`
- `MARKETER`
- `ADMIN`
- `OPERATIONS`
- `SUPPORT`
- `FINANCE`

A user may hold multiple roles over time. Permissions are authoritative for sensitive operations.

Supervisor and provider-admin capabilities are flags or scoped permissions on provider workers; they do not require separate identity systems.

### 4.2 Customer types

- `individual`
- `company`
- `engineer`

All customer types use the `CUSTOMER` role.

### 4.3 Authentication entry points

- Consumer
- Partner/provider
- Marketer

These are entry surfaces over one identity system, not separate authentication stacks.

### 4.4 Verification rules

#### Individual customer

- Phone is required.
- Six-digit SMS OTP verification is blocking.
- Email is optional.
- If email is supplied, email verification is encouraged but non-blocking.

#### Company or engineer customer

- Phone is required but not SMS-verified.
- Email is required.
- Email OTP verification is blocking.

#### Provider owner

- Phone is required but not SMS-verified.
- Email is required.
- Email OTP verification is blocking.

#### Worker

- Worker is created or invited by a provider.
- Login uses phone and password.

#### Marketer

- Marketer activation follows the Release 2 activation-fee rules.

Ban and suspension must be enforced at application entry and protected endpoints.

---

## 5. Provider lifecycle and supply

A provider moves through controlled lifecycle states:

```text
draft → pending_review → verified → live
                          ↘ suspended
```

A provider is not visible in Browse or Recommended unless required profile sections are complete and the provider is approved and live.

Provider profile areas include:

- Business identity
- Description
- Contacts
- Gallery
- Services and prices
- Coverage
- Team and workers
- Payout destination
- Completion percentage
- Verification records
- Operational status

### 5.1 Workers and teams

Workers have mini-profiles containing at least:

- Name
- Phone
- Avatar when available
- Role/title
- Required gender: `male` or `female`
- Active state
- Supervisor flag
- Provider-admin flag

A provider may group workers into teams.

The customer crew preference is:

- `all_male`
- `all_female`
- `any`

A female cleaning crew may include male escorts who do not clean. The assignment model must record this explicitly, for example with `cleans = false`, and customer-facing copy must explain it.

---

## 6. Catalog and localization

The platform owns the service catalog.

- Categories contain services.
- Catalog names and descriptions support Arabic and English.
- Providers select catalog services and define their own prices.
- Price units are configurable, such as flat, hourly, per room, or per square metre.
- Confirmed bookings preserve service and price snapshots.
- Historical orders must not silently change when catalog or provider pricing changes.

Launch is Egypt only, but country-sensitive configuration must use `countryCode`. Business code must not hard-code Egypt.

---

## 7. Money and payments

### 7.1 Deposit and shares

The customer pays a configurable deposit before order confirmation.

Default business split:

- Cleanora deposit/platform take: 25%
- Provider share: 75%

The final percentages come from server-side configuration.

### 7.2 Remaining amount

The customer may use one of the supported paths:

#### COD

The customer pays the provider share in cash to the provider or supervisor. The system records a timestamped cash-received confirmation event.

#### Full online or online remaining

Cleanora receives the online amount. The provider share becomes a payable due owed by Cleanora and is settled through an approved external payout method.

### 7.3 No internal stored-value wallets

Cleanora does not provide customer, provider, or marketer stored-value wallets.

The term **mobile wallet** may only mean an external payout or payment rail, such as a configured mobile-wallet number. It must not mean reusable stored value held inside Cleanora.

The payment gateway may have an external funding or payout account whose available balance is monitored. That is infrastructure funding, not a Cleanora user wallet.

### 7.4 Ledger

Financial control uses an immutable ledger or equivalent append-only financial records.

Typical entry types include:

- Deposit
- Platform fee
- Provider share
- Marketer commission
- COD remaining
- Payout
- Refund
- Adjustment

Gateway redirects are not proof of payment. Payment webhooks must be idempotent. The browser must not be trusted to calculate financial totals.

Financial records must use decimal-safe money handling and must not be hard-deleted.

---

## 8. Order lifecycle and execution

The exact database enum strings remain an open implementation decision until frozen, but the conceptual journey is:

```text
draft
→ awaiting_deposit
→ confirmed
→ assigned
→ on_the_way
→ in_progress
→ completed
```

Cancellation and failure paths exist according to the status matrix. Emergency is preferably a parallel flag on active orders unless the final status design explicitly decides otherwise.

A formal transition matrix must define:

- Actor
- From state
- To state
- Preconditions
- Side effects
- Audit requirement

### 8.1 Assignment

The provider assigns eligible workers or an existing team. Assignment must respect ownership, active status, schedule, team composition, and crew preference.

### 8.2 Completion code

Order completion requires a six-digit code sent to the customer by SMS.

- Worker or supervisor enters the code.
- The order cannot complete without a valid code.
- TTL and maximum attempts are configurable.
- Optional completion media may be uploaded.
- Completion evidence remains linked to the order.

### 8.3 Panic and emergency

Worker, supervisor, or provider-admin may trigger panic for an active order.

The system must:

- Mark the order as emergency.
- Notify Cleanora operations/admin.
- Notify the provider.
- Create an emergency dossier.
- Keep an audit trail.
- Restrict emergency clearing to authorized actors with a reason.

Live location is optional, consent-based, and delivered in Release 3.

---

## 9. Ratings and reviews

The initial product supports basic trust feedback after completed orders:

- Provider rating
- Assigned-team rating
- Written review
- One review per completed order
- Verified-order ownership checks
- Rating aggregation

Detailed dimensions, editing windows, publication rules, and advanced moderation remain open unless separately approved.

---

## 10. Support

Cleanora supports:

- Complaint linked to an order
- General support without an order

Support staff can list, filter, reply, assign, change status, and complete tickets.

Emergency, refund, and serious operational incidents should be linkable to support records.

---

## 11. Marketers

The marketer model is commission per eligible order.

Lifecycle:

1. Marketer registers.
2. Configured activation fee is paid, or zero fee activates automatically.
3. Active marketer receives a complex referral key.
4. A customer signing up through the valid key is attributed at signup.
5. Attribution lasts for the configured period.
6. Eligible completed/non-refunded orders create marketer commission according to the approved rule.
7. Commission comes from Cleanora's share and never reduces the provider share.
8. A sales-target cap may stop further commission.
9. Settlement uses external payout methods and no internal wallet.

Fraud controls include self-referral prevention, refund clawback, audit, and admin attribution detachment.

---

## 12. Premium providers

Premium is a paid provider growth feature.

It may provide:

- Featured badge
- Higher Browse/search position
- Configured gallery or visibility benefits

Premium affects ranking only after eligibility. It must never make an ineligible provider bookable.

---

## 13. Notifications and templates

Channels:

- Customers: SMS and push
- Providers/workers: email and Firebase push
- Marketers: email and push when the marketer release is active

All user-facing message bodies come from admin-editable templates with variables and Arabic/English content.

WebSockets are limited to features that truly require real time, such as Recommended, live location, and panic-related live updates. Other flows use REST and notifications.

---

## 14. Admin and staff control

The admin panel is an action surface, not a read-only dashboard.

Authorized staff may:

- Ban, unban, suspend, and reinstate accounts
- Verify or revoke provider verification
- Cancel and reassign orders
- Force allowed status transitions
- Clear or escalate emergencies
- Handle refunds and financial adjustments
- Trigger, hold, or record payouts
- Manage catalog, country configurations, and templates
- Manage marketers and premium features when their release is active
- Review full operational dossiers

Every privileged write requires:

- Permission
- Reason
- Before/after audit data
- Actor and timestamp

---

## 15. Non-functional rules

- Backend is authoritative.
- Payment webhooks are idempotent.
- Financial amounts are decimal-safe.
- Confirmed records preserve historical snapshots.
- Sensitive actions are audited.
- Country-sensitive rules are configured by country code.
- Catalog and templates support Arabic and English.
- Realtime is used only where justified.
- Responsive web is the initial client surface.
- Media is stored through protected object storage.
- No implementation may silently invent an open business rule.

---

## 16. Product boundaries for the three approved releases

The approved three-release delivery model is defined in `roadmap.md`.

Not included unless later approved:

- Internal stored-value wallets
- Native mobile apps
- Multi-country launch
- Insurance and claims
- Recurring packages
- Subscription plans
- Complex loyalty points
- Unbounded in-order chat
- Coupons until stacking and accounting rules are approved
