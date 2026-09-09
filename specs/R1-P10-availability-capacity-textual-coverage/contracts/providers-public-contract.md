# Providers Public Operational Availability Contract

`ProviderOperationalAvailabilityReader` is exported only from `src/modules/providers/providers.public.ts`.

```ts
interface ProviderOperationalAvailabilityReader {
  findCandidateProviderIdsForActiveTextualArea(input: {
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
  }): Promise<readonly string[]>;

  evaluateOneProviderOperationalAvailability(input: {
    readonly providerId: string;
    readonly districtId?: string;
    readonly location?: {
      readonly countryId: string;
      readonly cityId: string;
      readonly districtId?: string;
    };
    readonly utcInterval: {
      readonly startsAt: string;
      readonly endsAt: string;
    };
    readonly requiredCompleteTeamUnits: number;
  }): Promise<ProviderOperationalAvailabilityEvaluation | null>;
}

interface ProviderOperationalAvailabilityEvaluation {
  readonly providerId: string;
  readonly timeZone: string | null;
  readonly coverageMatch: {
    readonly matched: boolean;
    readonly countryId: string | null;
    readonly cityId: string | null;
    readonly districtId: string | null;
    readonly matchedBy: "CITY" | "DISTRICT" | null;
  };
  readonly availability: {
    readonly available: boolean;
    readonly runtimeAvailable: boolean;
    readonly providerScheduleAvailable: boolean;
  };
  readonly capacity: {
    readonly availableUnits: number;
    readonly requiredCompleteTeamUnits: number;
    readonly sufficient: boolean;
  };
  readonly blockerCodes: readonly ProviderOperationalAvailabilityBlockerCode[];
  readonly versions: {
    readonly availability: number;
    readonly workforce: number;
    readonly capacity: number;
  };
}
```

Inputs use ISO-8601 UTC instants and active textual identifiers. A city selection
matches every district in that city, while a district selection never implies
whole-city coverage. Evaluation also requires the resolved area country to
match the Provider's current country. `null` means the Provider is absent or is
not approved. Stable blockers distinguish area inactive/mismatch, Provider
schedule closure, Worker/Team unavailability, suspension, pause and
insufficient units. `versions.workforce` is the Provider aggregate workforce
state version, not the maximum version of individual Team/Worker rows. Output
contains no private contacts, names or raw persistence rows and does not
reserve supply.
