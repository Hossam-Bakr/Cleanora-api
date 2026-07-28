import type { Server } from "node:http";


import { TestLogger } from "../../helpers/test-logger.js";
import {
  bindPrismaClient,
  getPrismaClient,
  resetPrismaClientForTests
} from "../../../src/integrations/database/prisma-client-accessor.js";
import { PrismaLifecycle } from "../../../src/integrations/database/prisma-lifecycle.js";
import { AppConfigRepository } from "../../../src/modules/configuration/infrastructure/app-config.repository.js";
import { createGracefulShutdown } from "../../../src/server.js";

const testDatabaseUrl =
  "postgresql://test:test@localhost:5432/cleanora_prisma_identity_test";

describe("process-wide Prisma lifecycle", () => {
  beforeEach(() => {
    resetPrismaClientForTests("test");
  });

  afterEach(() => {
    resetPrismaClientForTests("test");
  });

  it("fails explicitly when a repository accesses Prisma before binding", () => {
    expect(() => getPrismaClient()).toThrow(/not bound/);
  });

  it("uses the same client identity for health probes and repositories", async () => {
    const lifecycle = new PrismaLifecycle(testDatabaseUrl);
    const query = vi
      .spyOn(lifecycle.client, "$queryRaw")
      .mockResolvedValue([{ connected: 1 }] as never);
    const findConfig = vi
      .spyOn(lifecycle.client.appConfig, "findUnique")
      .mockResolvedValue(null);

    bindPrismaClient(lifecycle.client);
    expect(getPrismaClient()).toBe(lifecycle.client);

    await lifecycle.databaseProbe().check();
    const repository = new AppConfigRepository();
    await repository.findByKey("platform.default_timezone");
    await repository.findByKey("platform.default_timezone");

    expect(query).toHaveBeenCalledTimes(1);
    expect(findConfig).toHaveBeenCalledTimes(2);
    expect(getPrismaClient()).toBe(lifecycle.client);
  });

  it("connects and disconnects the lifecycle client at most once", async () => {
    const lifecycle = new PrismaLifecycle(testDatabaseUrl);
    const connect = vi
      .spyOn(lifecycle.client, "$connect")
      .mockResolvedValue(undefined);
    const warm = vi
      .spyOn(lifecycle.client, "$queryRaw")
      .mockResolvedValue([{ ok: 1 }] as never);
    const disconnect = vi
      .spyOn(lifecycle.client, "$disconnect")
      .mockResolvedValue(undefined);

    await Promise.all([lifecycle.connect(), lifecycle.connect()]);
    await Promise.all([lifecycle.disconnect(), lifecycle.disconnect()]);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(warm).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("graceful shutdown disconnects the shared lifecycle exactly once", async () => {
    const close = vi.fn((callback: (error?: Error) => void) => callback());
    const closeAllConnections = vi.fn();
    const server = { close, closeAllConnections } as unknown as Server;
    const disconnect = vi.fn(async () => Promise.resolve());
    const shutdown = createGracefulShutdown(
      server,
      { disconnect },
      new TestLogger(),
      1_000
    );

    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(closeAllConnections).not.toHaveBeenCalled();
  });

  it("test reset cannot change production binding behavior", () => {
    const lifecycle = new PrismaLifecycle(testDatabaseUrl);
    bindPrismaClient(lifecycle.client);

    expect(() => resetPrismaClientForTests("production")).toThrow(
      /only in test composition/
    );
    expect(getPrismaClient()).toBe(lifecycle.client);

    const secondLifecycle = new PrismaLifecycle(testDatabaseUrl);
    expect(() => bindPrismaClient(secondLifecycle.client)).toThrow(
      /different process-wide Prisma client/
    );
  });
});
