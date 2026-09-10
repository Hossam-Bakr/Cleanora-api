# Browse DTOs & privacy contract (R1-P12)

## Contact-free allowlist

Same spirit as `PROVIDER_PREVIEW_FIELD_ALLOWLIST`, plus sortingFacts and crew aggregates.

Forbidden markers must never appear in Browse JSON (case-sensitive substring tests):

- operationalEmail, operationalPhone, channels, whatsapp, WHATSAPP, SOCIAL, WEBSITE, EXTERNAL_BOOKING
- applicantContext, individualFullName, companyName, representativeFullName
- storageKey, logoMediaFileId, coverMediaFileId
- workerId (crew summary must aggregate only)
- email, phone (as contact fields)

## Crew summary shape

```ts
{
  teamId: string;
  active: boolean;
  cleanerCount: number;
  escortCount: number;
  genderCounts: { male: number; female: number; other: number };
}
```

No member arrays. No workerId.

## EX-01 media

Logo/cover → `null` if signing fails. Gallery skips failed items.
