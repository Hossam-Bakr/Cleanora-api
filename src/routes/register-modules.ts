import type { Express } from "express";

import type { ModuleRegistrar } from "#core/http/module-registrar";
import { adminModuleRegistrar } from "#modules/admin";
import { configurationModuleRegistrar } from "#modules/configuration";

export type { ModuleRegistrar } from "#core/http/module-registrar";

export const foundationModuleRegistrars: readonly ModuleRegistrar[] = [
  configurationModuleRegistrar,
  adminModuleRegistrar
];

/**
 * @desc Register approved business-module routes.
 * @access Internal composition only
 * @explanation This function prevents two modules from using the same
 * registration name and keeps route composition in one place.
 */
export function registerModules(
  app: Express,
  modules: readonly ModuleRegistrar[]
): void {
  const names = new Set<string>();

  for (const module of modules) {
    if (names.has(module.name)) {
      throw new Error(`Duplicate module registration: ${module.name}`);
    }

    names.add(module.name);
    module.register(app);
  }
}
