/** Trusted server capability for privacy processor claim/resolve (composition-only). */
export const PRIVACY_PROCESSOR_CAPABILITY = "privacy.requests.process" as const;

export type PrivacyProcessorCapability = typeof PRIVACY_PROCESSOR_CAPABILITY;
