import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "#generated/prisma/client";

export interface DatabaseProbe {
  check(): Promise<void>;
}

export interface ReadinessProbe {
  readonly name: string;
  check(): Promise<void>;
}

function createDatabaseProbe(
  checkConnection: () => Promise<void>,
): DatabaseProbe {
  return { check: checkConnection };
}

/** Keep one small process-owned pool so tests and app composition cannot open unbounded pg clients. */
const DEFAULT_POOL_MAX = 2;

export class PrismaLifecycle {
  readonly client: PrismaClient;
  private readonly pool: pg.Pool;
  private connectPromise: Promise<void> | undefined;
  private disconnectPromise: Promise<void> | undefined;

  /**
   * @desc Create the shared Prisma database lifecycle.
   * @access Internal infrastructure only
   * @explanation This constructor creates one Prisma client and one explicit
   * pg pool for the whole application so repositories share connections and
   * disconnect can deterministically end the pool.
   */
  constructor(
    connectionString: string,
    options: {
      readonly maxConnections?: number;
      /** Prefer IPv4 when the local network cannot reach Neon IPv6 endpoints. */
      readonly forceIpv4?: boolean;
    } = {}
  ) {
    this.pool = new pg.Pool({
      connectionString,
      max: options.maxConnections ?? DEFAULT_POOL_MAX,
      allowExitOnIdle: true,
      ...(options.forceIpv4 === true ? { family: 4 } : {}),
    });
    const adapter = new PrismaPg(this.pool, { disposeExternalPool: true });
    this.client = new PrismaClient({ adapter });
  }

  /**
   * @desc Connect the application to PostgreSQL.
   * @access Internal infrastructure only
   * @explanation This function opens the database connection and warms one
   * pooled client before HTTP handlers or tests start transactions, so the
   * first interactive transaction is not racing a cold SSL handshake under
   * Prisma's default transaction maxWait.
   */
  async connect(): Promise<void> {
    this.connectPromise ??= (async () => {
      await this.client.$connect();
      await this.client.$queryRaw`SELECT 1`;
    })();
    await this.connectPromise;
  }

  /**
   * @desc Disconnect the application from PostgreSQL.
   * @access Internal infrastructure only
   * @explanation This function closes Prisma and ends the owned pg pool so
   * test compositions cannot leave remote connections behind.
   */
  async disconnect(): Promise<void> {
    this.disconnectPromise ??= this.client.$disconnect();
    await this.disconnectPromise;
  }

  /**
   * @desc Build the PostgreSQL readiness probe.
   * @route GET /api/v1/system/health/ready
   * @access Public
   * @explanation This probe runs a safe SELECT 1 query and never returns
   * credentials or database contents.
   */
  readinessProbe(): ReadinessProbe {
    return {
      name: "postgresql",
      check: async (): Promise<void> => {
        await this.client.$queryRaw`SELECT 1`;
      }
    };
  }

  /**
   * @desc Build the dedicated PostgreSQL connectivity probe.
   * @access Internal infrastructure only
   * @explanation This probe checks only database connectivity so the system
   * route can distinguish it from broader readiness failures.
   */
  databaseProbe(): DatabaseProbe {
    return createDatabaseProbe(async (): Promise<void> => {
      await this.client.$queryRaw`SELECT 1`;
    });
  }
}
