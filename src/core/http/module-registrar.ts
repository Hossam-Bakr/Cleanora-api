import type { Express } from "express";

/**
 * Business-neutral contract used by the application composition root to mount
 * approved module routes without making modules depend on `src/routes`.
 */
export interface ModuleRegistrar {
  readonly name: string;
  register(app: Express): void;
}
