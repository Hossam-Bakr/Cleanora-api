# Module Public Contracts

## Dependency direction

```text
providers -> authentication.public
providers -> customers.public
providers -> configuration.public
providers -> media.public
providers -> admin.audit.public
providers -> EmailPort

composition -> infrastructure factories from each owner
future modules -> providers.public
```

No reverse Authentication/Customers/Media dependency on `providers` is
required. No module imports another module's controller, routes, repository,
Prisma delegate/model, or internal domain file.

## `providers/providers.public.ts`

Stable reads for later approved phases only:

```ts
interface ProviderPublicReader {
  getProviderIdentity(providerId: string): Promise<{
    providerId: string;
    kind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";
    ownerUserId: string | null;
    applicationStatus: ProviderApplicationStatus;
    operationalStatus: ProviderOperationalStatus;
  } | null>;

  getMembershipScope(input: {
    userId: string;
    providerId: string;
  }): Promise<{
    providerId: string;
    level: "OWNER" | "ADMIN";
    status: "ACTIVE" | "DISABLED";
  } | null>;

  getMarketplaceReadiness(providerId: string): Promise<MarketplaceReadiness>;
}
```

No public method returns contacts, storage keys, invitation verifiers, audit
payloads, or raw Prisma records.

## Authentication public additions

### `ProviderIdentityReader`

Reads current transaction-safe eligibility/contact facts:

- active/non-verification-only identity state;
- verified/enrolled category arrays;
- normalized account email and phone plus verification labels;
- enabled `provider_admin` role state when needed.

### `ProviderIdentityAuthorityWriter`

Transaction-bound and callable only from the Provider-owned unit of work:

```ts
interface ProviderIdentityAuthorityWriter {
  grantOwnerAuthority(userId: string): Promise<void>;
  reconcileProviderAdminRole(input: {
    userId: string;
    shouldBeEnabled: boolean;
  }): Promise<void>;
}
```

`grantOwnerAuthority` may only add verified `PROVIDER_OWNER` and assign/enable
the existing `provider_admin` role. It cannot grant Staff, Worker, Customer, or
other categories/roles. It is idempotent and never opens its own transaction.

### Invitation-only identity onboarding

Authentication owns password hashing, identity/credential creation, email OTP,
verification-only session behavior, and verification. Providers supplies a
server-validated fixed email for a still-valid invitation. The public commands
do not accept a customer category and create empty category arrays.

The verify command returns a restricted authenticated onboarding principal bound
to the fixed email. It may call only invitation acceptance and session cleanup;
Provider authority is absent until the separate acceptance transaction succeeds.
After acceptance, Authentication derives full login capability from its own
enabled `provider_admin` role. Exact active membership remains a Providers-owned
resource check, so Authentication never imports or queries Provider persistence.

## Customers public addition

`ProviderApplicantProfileReader` returns only:

- matching category (`INDIVIDUAL` or `COMPANY`);
- whether the required matching profile exists/is complete;
- Individual full name, or Company name and representative name, for private
  review context.

It never mutates profiles and does not return unrelated preferences, addresses,
privacy records, images, tax id, or registration id for R1-P05 review.

## Configuration public addition

`ActiveCountryReader.resolveActiveCountry(countryCode)` returns `{ id, code }`
only for an active country, otherwise a safe domain not-found/inactive outcome.

## Media public additions

Providers requests purpose-specific operations:

- normalize Provider logo/cover/gallery image;
- reserve/store/finalize Provider video with authoritative Cloudinary metadata;
- create signed image/video/derived-thumbnail delivery URLs;
- mark abandoned/replaced assets pending delete;
- clean bounded pending assets.

The contract returns safe opaque `mediaId`, status, MIME, bytes, width, height,
and signed URL/expiry. It never returns storage key, Cloudinary public id,
credentials, raw provider response, or unrestricted delete capability.

Providers supplies an already-authorized business purpose. Media never decides
Provider membership or application state.

## Admin audit public additions

Create a named `admin/audit.public.ts` entry point that exposes business-neutral
general transactional audit and safe denial audit types. Infrastructure
factories remain composed at the root. Providers never imports
`admin/infrastructure/*`.

Audit context is allowlisted identifiers/statuses/counters only. Direct
contacts, identity names, raw reason payloads where unnecessary, storage keys,
invitation tokens, OTPs, credentials, and provider payloads are prohibited.

## Email boundary

Providers owns closed template keys and durable intent. `EmailPort` receives a
rendered template intent, locale, authoritative recipient, variables, and
idempotency key. SMTP configuration and provider results do not enter the
providers module.

Durable intent is limited to application submission/review and operational
lifecycle notices. Provider Admin invitation creation/resend returns a raw token
only to the in-process service after commit; the service passes it directly to a
dedicated invitation delivery method and then discards it. On failure it records
safe resend-required state. The raw token is never an outbox field, template
payload, log, audit value, or response value.
