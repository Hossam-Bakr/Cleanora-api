import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { bindPrismaClient, resetPrismaClientForTests } from "../../../src/database/prisma.js";
import { PrismaProviderWorkforceCommandRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-workforce-command.repository.js";
import { PrismaProviderWorkforceHistoryRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-workforce-history.repository.js";
import { PrismaProviderWorkforceNotificationRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-workforce-notification.repository.js";
import { PrismaProvidersWorkforceUnitOfWork } from "../../../src/modules/providers/infrastructure/prisma-providers-workforce.unit-of-work.js";
import { mapPrismaWorkforceError } from "../../../src/modules/providers/infrastructure/provider-workforce.prisma-errors.js";
import {
  ProviderWorkforceNotificationDispatcher,
  startProviderWorkforceNotificationDispatcher,
} from "../../../src/modules/providers/provider-workforce-notification.dispatcher.js";
import { WorkforcePolicyError } from "../../../src/modules/providers/domain/provider-workforce.policy.js";

const now = new Date("2026-08-23T06:00:00.000Z");

describe("R1-P07 workforce persistence infrastructure", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetPrismaClientForTests("test");
  });

  it("serializes command keys, replays only matching accepted fingerprints, and CAS-accepts once", async () => {
    const queryRaw = vi.fn(async (..._args: unknown[]) => []);
    const findUnique = vi.fn();
    const create = vi.fn(async () => ({ id: "command-1" }));
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const repository = new PrismaProviderWorkforceCommandRepository({
      $queryRaw: queryRaw,
      providerWorkforceCommand: { findUnique, create, updateMany },
    } as never);
    const input = {
      providerId: "provider-1",
      scopeKey: "WORKER:worker-1:LIFECYCLE",
      idempotencyKey: "command-key",
      requestFingerprint: "fingerprint-1",
      actorUserId: "owner-1",
    } as const;

    findUnique.mockResolvedValueOnce(null);
    await expect(repository.begin(input)).resolves.toEqual({ replay: false, result: null });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const lockTemplate = queryRaw.mock.calls[0]?.[0];
    const lockSql = Array.isArray(lockTemplate) ? lockTemplate.join(" ") : String(lockTemplate ?? "");
    expect(lockSql).toContain("SELECT 1 AS locked");
    expect(lockSql).toContain("pg_advisory_xact_lock");
    expect(lockSql).not.toMatch(/SELECT\s+pg_advisory_xact_lock\s*\(/);
    expect(create).toHaveBeenCalledWith({ data: input });

    findUnique.mockResolvedValueOnce({
      requestFingerprint: "fingerprint-1",
      actorUserId: "owner-1",
      status: "ACCEPTED",
      safeResultJson: { outcomeCode: "WORKER_ACTIVATED" },
    });
    await expect(repository.begin(input)).resolves.toEqual({
      replay: true,
      result: { outcomeCode: "WORKER_ACTIVATED" },
    });

    findUnique.mockResolvedValueOnce({ requestFingerprint: "different", actorUserId: "owner-1", status: "ACCEPTED" });
    await expect(repository.begin(input)).rejects.toMatchObject({
      code: "WORKFORCE_IDEMPOTENCY_KEY_CONFLICT",
    });
    findUnique.mockResolvedValueOnce({ requestFingerprint: "fingerprint-1", actorUserId: "other-owner", status: "ACCEPTED" });
    await expect(repository.begin(input)).rejects.toMatchObject({
      code: "WORKFORCE_IDEMPOTENCY_KEY_CONFLICT",
    });
    findUnique.mockResolvedValueOnce({ requestFingerprint: "fingerprint-1", actorUserId: "owner-1", status: "IN_PROGRESS" });
    await expect(repository.begin(input)).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });

    await repository.accept({
      scopeKey: input.scopeKey,
      idempotencyKey: input.idempotencyKey,
      safeResultCode: "WORKER_ACTIVATED",
      safeResult: { targetId: "worker-1", version: 2 },
    });
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(repository.accept({
      scopeKey: input.scopeKey,
      idempotencyKey: input.idempotencyKey,
      safeResultCode: "WORKER_ACTIVATED",
      safeResult: {},
    })).rejects.toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
  });

  it("persists allowlisted immutable history and returns aggregate Worker history", async () => {
    const historyRow = {
      id: "history-1",
      providerId: "provider-1",
      targetType: "WORKER" as const,
      targetId: "worker-1",
      targetVersion: 2,
      eventCode: "WORKER_ACTIVATED",
      actorUserId: "owner-1",
      reasonCode: "RETURNED_TO_DUTY",
      note: "approved note",
      safeBefore: { status: "INACTIVE", version: 1 },
      safeAfter: { status: "ACTIVE", version: 2 },
      requestId: "request-1",
      createdAt: now,
    };
    const create = vi.fn(async () => ({ id: historyRow.id }));
    const findMany = vi.fn()
      .mockResolvedValueOnce([historyRow])
      .mockResolvedValueOnce([{ id: "invitation-1" }])
      .mockResolvedValueOnce([{ id: "membership-1" }])
      .mockResolvedValueOnce([historyRow]);
    const repository = new PrismaProviderWorkforceHistoryRepository({
      providerWorkforceHistory: { create, findMany },
      providerWorkerInvitation: { findMany },
      providerTeamMembership: { findMany },
    } as never);

    await expect(repository.append({
      providerId: historyRow.providerId,
      targetType: historyRow.targetType,
      targetId: historyRow.targetId,
      targetVersion: historyRow.targetVersion,
      eventCode: historyRow.eventCode,
      actorUserId: historyRow.actorUserId,
      reasonCode: historyRow.reasonCode,
      note: historyRow.note,
      safeBefore: historyRow.safeBefore,
      safeAfter: historyRow.safeAfter,
      requestId: historyRow.requestId,
    })).resolves.toEqual({ id: "history-1" });
    await expect(repository.list({
      providerId: "provider-1", targetType: "WORKER", targetId: "worker-1", limit: 20,
    })).resolves.toEqual([historyRow]);
    await expect(repository.listForWorker({
      providerId: "provider-1", workerId: "worker-1", limit: 20, cursor: "history-cursor",
    })).resolves.toEqual([historyRow]);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([
        expect.objectContaining({ targetType: "INVITATION" }),
        expect.objectContaining({ targetType: "TEAM_MEMBERSHIP" }),
      ]) }),
      cursor: { id: "history-cursor" },
      skip: 1,
    }));

    await expect(repository.append({
      providerId: "provider-1", targetType: "WORKER", targetId: "worker-1",
      targetVersion: 2, eventCode: "UNSAFE", actorUserId: "owner-1",
      safeAfter: { phone: "+201000000000" } as never, requestId: "request-2",
    })).rejects.toMatchObject({ code: "WORKFORCE_HISTORY_UNSAFE" });
  });

  it("maps history rows with absent optional evidence and no related invitation/membership branches", async () => {
    const sparseRow = {
      id: "history-sparse", providerId: "provider-1", targetType: "WORKER" as const,
      targetId: "worker-1", targetVersion: 1, eventCode: "WORKER_DRAFT_CREATED",
      actorUserId: "owner-1", reasonCode: null, note: null, safeBefore: null, safeAfter: null,
      requestId: "request-sparse", createdAt: now,
    };
    const invitationFindMany = vi.fn(async () => []);
    const membershipFindMany = vi.fn(async () => []);
    const historyFindMany = vi.fn(async () => [sparseRow]);
    const repository = new PrismaProviderWorkforceHistoryRepository({
      providerWorkerInvitation: { findMany: invitationFindMany },
      providerTeamMembership: { findMany: membershipFindMany },
      providerWorkforceHistory: { findMany: historyFindMany },
    } as never);
    await expect(repository.listForWorker({ providerId: "provider-1", workerId: "worker-1", limit: 10 })).resolves.toEqual([{
      id: "history-sparse", providerId: "provider-1", targetType: "WORKER", targetId: "worker-1",
      targetVersion: 1, eventCode: "WORKER_DRAFT_CREATED", actorUserId: "owner-1",
      requestId: "request-sparse", createdAt: now,
    }]);
    expect(historyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [expect.objectContaining({ targetId: "worker-1" })] }),
    }));
  });

  it("leases safe notification intents and isolates send/failure state changes", async () => {
    const queryRaw = vi.fn(async () => [{ id: "notification-1" }]);
    const create = vi.fn(async () => ({ id: "notification-1" }));
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const update = vi.fn(async () => ({ id: "notification-1" }));
    const findMany = vi.fn(async () => [{
      id: "notification-1",
      template: "INVITATION_ISSUED",
      locale: "EN",
      recipientUserId: null,
      recipientEmailNormalized: "worker@example.invalid",
      invitationId: "invitation-1",
      historyId: "history-1",
      idempotencyKey: "notification-key",
      safeVariables: { workerId: "worker-1" },
      createdAt: now,
    }]);
    const repository = new PrismaProviderWorkforceNotificationRepository({
      $queryRaw: queryRaw,
      providerWorkforceNotificationIntent: { create, updateMany, findMany, update },
    } as never);

    await repository.insert({
      providerId: "provider-1",
      template: "INVITATION_ISSUED",
      locale: "EN",
      recipientEmailNormalized: "worker@example.invalid",
      invitationId: "invitation-1",
      historyId: "history-1",
      safeVariables: { workerId: "worker-1" },
      idempotencyKey: "notification-key",
    });
    await expect(repository.lease(25, now, new Date(now.getTime() + 60_000))).resolves.toEqual([
      expect.objectContaining({ id: "notification-1", invitationId: "invitation-1" }),
    ]);
    await repository.markSent("notification-1", now);
    await repository.markFailed("notification-1", "WORKFORCE_EMAIL_DELIVERY_FAILED", new Date(now.getTime() + 60_000));
    expect(update).toHaveBeenCalledTimes(2);

    queryRaw.mockResolvedValueOnce([]);
    await expect(repository.lease(25, now, now)).resolves.toEqual([]);
    await expect(repository.insert({
      providerId: "provider-1", template: "WORKER_ACTIVATED", locale: "AR",
      recipientUserId: "worker-user", recipientEmailNormalized: "worker@example.invalid",
      safeVariables: {}, idempotencyKey: "unsafe-recipient",
    })).rejects.toMatchObject({ code: "WORKFORCE_NOTIFICATION_RECIPIENT_INVALID" });
  });

  it("builds every transaction-bound adapter and maps only known Prisma failures", async () => {
    const transaction = {};
    const client = {
      $transaction: vi.fn(async (work: (value: typeof transaction) => unknown, options: unknown) => {
        expect(options).toEqual({ maxWait: 15_000, timeout: 60_000 });
        return work(transaction);
      }),
    } as unknown as PrismaClient;
    bindPrismaClient(client);
    const factories = {
      identityReader: vi.fn(() => ({ getIdentity: vi.fn(), findByEmailNormalized: vi.fn() })),
      identityAuthority: vi.fn(() => ({
        reconcileWorkerRole: vi.fn(), reconcileProviderSupervisorRole: vi.fn(), reconcileProviderAdminRole: vi.fn(),
      })),
      proof: vi.fn(() => ({ assertConsumed: vi.fn() })),
      avatar: vi.fn(() => ({ assertReadyOwnedProfileImage: vi.fn() })),
      audit: vi.fn(() => ({ append: vi.fn() })),
    };
    const unitOfWork = new PrismaProvidersWorkforceUnitOfWork(
      factories.identityReader as never,
      factories.identityAuthority as never,
      factories.proof as never,
      factories.avatar as never,
      factories.audit as never,
    );
    await expect(unitOfWork.run(async (context) => {
      expect(context.workforce).toBeDefined();
      expect(context.commands).toBeDefined();
      expect(context.history).toBeDefined();
      expect(context.notifications).toBeDefined();
      expect(context.identityReader).toBeDefined();
      expect(context.identityAuthority).toBeDefined();
      expect(context.proofUseAuthorizer).toBeDefined();
      expect(context.avatarAuthorizer).toBeDefined();
      expect(context.audit).toBeDefined();
      return "committed";
    })).resolves.toBe("committed");
    expect(factories.identityReader).toHaveBeenCalledWith(transaction);

    expect(mapPrismaWorkforceError({ code: "P2025" })).toMatchObject({ code: "WORKFORCE_RESOURCE_NOT_FOUND" });
    expect(mapPrismaWorkforceError({ code: "P2002" })).toMatchObject({ code: "WORKFORCE_STATE_CONFLICT" });
    expect(mapPrismaWorkforceError({ code: "P9999" })).toBeNull();
    expect(mapPrismaWorkforceError("not-prisma")).toBeNull();
    const policyError = new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
    expect(mapPrismaWorkforceError(policyError)).toBe(policyError);
  });

  it("dispatches leases one by one, records safe retry state, and prevents overlapping timer ticks", async () => {
    const rows = [
      { id: "notification-1", template: "WORKER_ACTIVATED", locale: "AR", recipientUserId: "user-1", recipientEmailNormalized: null, invitationId: null, historyId: null, idempotencyKey: "key-1", safeVariables: {} },
      { id: "notification-2", template: "WORKER_DEACTIVATED", locale: "EN", recipientUserId: "user-2", recipientEmailNormalized: null, invitationId: null, historyId: null, idempotencyKey: "key-2", safeVariables: {} },
    ] as const;
    const repository = {
      lease: vi.fn(async () => rows),
      markSent: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
    };
    const delivery = {
      deliver: vi.fn(async (row: { readonly id: string }) => {
        if (row.id === "notification-2") throw new Error("synthetic SMTP failure");
      }),
    };
    const dispatcher = new ProviderWorkforceNotificationDispatcher(repository, delivery, () => now);
    await expect(dispatcher.dispatch(2)).resolves.toEqual({ sent: 1, failed: 1 });
    expect(repository.markSent).toHaveBeenCalledWith("notification-1", now);
    expect(repository.markFailed).toHaveBeenCalledWith(
      "notification-2", "WORKFORCE_EMAIL_DELIVERY_FAILED", new Date(now.getTime() + 60_000),
    );

    vi.useFakeTimers();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const timedDispatcher = { dispatch: vi.fn(async () => pending) };
    const logger = { error: vi.fn() };
    const stop = startProviderWorkforceNotificationDispatcher(timedDispatcher as never, logger, 10);
    await vi.advanceTimersByTimeAsync(25);
    expect(timedDispatcher.dispatch).toHaveBeenCalledTimes(1);
    release?.();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    expect(timedDispatcher.dispatch).toHaveBeenCalledTimes(2);
    stop();
  });
});
