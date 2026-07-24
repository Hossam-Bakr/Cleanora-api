export interface DatabaseProbe {
  check(): Promise<void>;
}

/**
 * @desc Create a safe database-connectivity probe.
 * @access Core health helper
 * @explanation The caller supplies the database query while this core helper
 * keeps the health route independent from Prisma implementation details.
 */
export function createDatabaseProbe(
  checkConnection: () => Promise<void>
): DatabaseProbe {
  return {
    check: checkConnection
  };
}
