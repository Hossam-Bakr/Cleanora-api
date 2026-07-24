export const DEFAULT_JOB_POLICY = {
  attempts: 5,
  backoffMilliseconds: 1_000
} as const;

export const QUEUE_NAME_PREFIX = "cleanora";
