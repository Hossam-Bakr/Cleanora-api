import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "#generated/prisma/client";
import {
  createDatabaseProbe,
  type DatabaseProbe
} from "#core/health/database-probe";
import type { ReadinessProbe } from "#core/health/readiness";

export class PrismaLifecycle {
  readonly client: PrismaClient;
  private connectPromise: Promise<void> | undefined;
  private disconnectPromise: Promise<void> | undefined;

  /**
   * @desc Create the shared Prisma database lifecycle.
   * @access Internal infrastructure only
   * @explanation This constructor creates one Prisma client for the whole
   * application and keeps the database adapter outside business modules.
   */
  constructor(connectionString: string) {
    const adapter = new PrismaPg({ connectionString });
    this.client = new PrismaClient({ adapter });
  }

  /**
   * @desc Connect the application to PostgreSQL.
   * @access Internal infrastructure only
   * @explanation This function opens the database connection before the HTTP
   * server starts accepting requests.
   */
  async connect(): Promise<void> {
    this.connectPromise ??= this.client.$connect();
    await this.connectPromise;
  }

  /**
   * @desc Disconnect the application from PostgreSQL.
   * @access Internal infrastructure only
   * @explanation This function closes database resources during shutdown.
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
