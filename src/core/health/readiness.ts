export interface ReadinessProbe {
  readonly name: string;
  check(): Promise<void>;
}
