import type { Server } from "node:http";


import { TestLogger } from "../../helpers/test-logger.js";
import {
  bindPrismaClient,
  getPrismaClient,
  resetPrismaClientForTests
} from "../../../src/database/prisma.js";
import { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { AppConfigRepository } from "../../../src/modules/configuration/configuration.repository.js";
import { createGracefulShutdown } from "../../../src/server-lifecycle.js";

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

  it("forces connections closed when graceful shutdown times out", async () => {
    const close = vi.fn((_callback: (error?: Error) => void) => undefined);
    const closeAllConnections = vi.fn();
    const server = { close, closeAllConnections } as unknown as Server;
    const shutdown = createGracefulShutdown(
      server,
      { disconnect: vi.fn(async () => Promise.resolve()) },
      new TestLogger(),
      5,
    );

    await expect(shutdown("SIGTERM")).rejects.toThrow(
      "Graceful shutdown timed out",
    );
    expect(closeAllConnections).toHaveBeenCalledOnce();
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

  it("maps optional Google profile and email fields during social persistence", async () => {
    const update = vi.fn(async () => ({ id: "social-1" }));
    const create = vi.fn(async () => ({ id: "social-2" }));
    const findUnique = vi.fn(async () => null);
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    bindPrismaClient({
      socialAccount: { update, create, findUnique, deleteMany },
    } as never);

    const { SocialAccountRepository } = await import(
      "../../../src/modules/authentication/infrastructure/auth.repository.js"
    );
    const repository = new SocialAccountRepository();

    await repository.updateGoogleProfile("subject-1", {});
    await repository.updateGoogleProfile("subject-1", {
      displayName: "Cleanora User",
    });
    await repository.updateGoogleProfile("subject-1", {
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar.png",
    });
    await repository.updateGoogleProfile("subject-1", {
      displayName: "Cleanora User",
      avatarUrl: "https://lh3.googleusercontent.com/a/avatar.png",
    });
    await repository.link("user-1", "subject-1");
    await repository.link("user-1", "subject-1", "person@example.test");
    await repository.findGoogle("subject-1");
    await repository.findGoogleByUserId("user-1");
    await repository.unlink("user-1");

    expect(update).toHaveBeenCalledTimes(4);
    expect(create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          providerEmailNormalized: null,
          providerEmailVerifiedAt: null,
        }),
      }),
    );
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          providerEmailNormalized: "person@example.test",
          providerEmailVerifiedAt: expect.any(Date),
        }),
      }),
    );
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledOnce();
  });
});
