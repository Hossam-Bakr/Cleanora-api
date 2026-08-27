import { createHash } from "node:crypto";

import { PrismaProviderVerificationRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-verification.repository.js";

const now = new Date("2026-08-24T12:00:00.000Z");
const issueDate = new Date("2024-01-01T00:00:00.000Z");
const expiresAt = new Date("2027-01-01T00:00:00.000Z");

function transactionDatabase(overrides: Record<string, unknown> = {}) {
  const database: Record<string, unknown> = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  database["$transaction"] = vi.fn(async (work: (transaction: unknown) => Promise<unknown>) => work(database));
  return database;
}

function repository(database: Record<string, unknown>) {
  return new PrismaProviderVerificationRepository(
    database as never,
    () => ({ append: vi.fn().mockResolvedValue(undefined) }) as never,
    () => ({ authorize: vi.fn().mockResolvedValue(true) }),
    () => ({ allReady: vi.fn().mockResolvedValue(true) }),
  );
}

describe("R1-P06 verification repository executable coverage", () => {
  it("builds bounded reads with and without cursors", async () => {
    const provider = { findUnique: vi.fn().mockResolvedValue({ id: "provider-1" }) };
    const policy = {
      findFirst: vi.fn().mockResolvedValue({ id: "policy-1" }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: "policy-1" }),
    };
    const chains = { findMany: vi.fn().mockResolvedValue([{ documentType: { code: "COMMERCIAL_REGISTRATION" } }]) };
    const documents = {
      findFirst: vi.fn().mockResolvedValue({ id: "document-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    };
    const history = { findMany: vi.fn().mockResolvedValue([]) };
    const types = { findMany: vi.fn().mockResolvedValue([]) };
    const subject = repository({
      provider,
      verificationDocumentPolicyVersion: policy,
      providerDocumentChain: chains,
      providerDocumentVersion: documents,
      providerVerificationHistory: history,
      verificationDocumentType: types,
    });

    await expect(subject.readProviderAccess("provider-1", "owner-1")).resolves.toEqual({ id: "provider-1" });
    await expect(subject.readEffectivePolicy({ countryId: "country-eg", providerKind: "REGISTERED_COMPANY", now })).resolves.toEqual({ id: "policy-1" });
    await expect(subject.listEffectiveDocumentTypeCodes("provider-1", now)).resolves.toEqual(["COMMERCIAL_REGISTRATION"]);
    await expect(subject.readDocument("provider-1", "document-1")).resolves.toEqual({ id: "document-1" });
    await subject.listDocuments({ providerId: "provider-1", limit: 0 });
    await subject.listDocuments({ providerId: "provider-1", limit: 500, cursorUpdatedAt: now, cursorId: "cursor" });
    await subject.listDocumentReviewQueue({ limit: 0 });
    await subject.listDocumentReviewQueue({ limit: 500, cursorSubmittedAt: now, cursorId: "cursor" });
    await subject.listHistory("provider-1");
    await subject.listHistory("provider-1", 500, { createdAt: now, id: "cursor" });
    await subject.listDocumentTypes();
    await subject.listPolicies({ limit: 0 });
    await subject.listPolicies({ limit: 500, cursorCreatedAt: now, cursorId: "cursor" });
    await subject.readPolicy("policy-1");

    expect(documents.findMany).toHaveBeenCalledTimes(4);
    expect(history.findMany).toHaveBeenCalledTimes(2);
  });

  it("creates and updates a company document draft atomically", async () => {
    const created = { id: "document-1", version: 1, status: "DRAFT" };
    const createDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
      providerDocumentVersion: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      verificationDocumentType: { findFirst: vi.fn().mockResolvedValue({ id: "type-1" }) },
      verificationDocumentPolicyVersion: { findFirst: vi.fn().mockResolvedValue({ id: "policy-1" }) },
      providerDocumentChain: { upsert: vi.fn().mockResolvedValue({ id: "chain-1" }) },
    });
    await expect(repository(createDb).createDraft({
      providerId: "provider-1",
      typeCode: "COMMERCIAL_REGISTRATION",
      countryCode: "EG",
      documentNumber: "REG-001",
      legalName: "Synthetic Company",
      issuerName: "Registry Authority",
      issueDate,
      expiresAt,
      actorUserId: "owner-1",
      commandId: "create-command",
      requestId: "request-1",
      now,
    })).resolves.toBe(created);

    const updated = { ...created, version: 2 };
    const updateDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerDocumentVersion: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
      },
    });
    await expect(repository(updateDb).updateDraft({
      providerId: "provider-1",
      documentVersionId: "document-1",
      expectedVersion: 1,
      countryCode: "EG",
      documentNumber: "REG-002",
      legalName: "Synthetic Company",
      issuerName: "Registry Authority",
      issueDate,
      expiresAt: null,
      actorUserId: "owner-1",
      commandId: "update-command",
      requestId: "request-2",
    })).resolves.toBe(updated);
  });

  it("binds, removes, and reorders draft evidence with exact version history", async () => {
    const authority = { id: "provider-1", profile: { countryId: "country-eg" } };
    const document = { id: "document-1", version: 2, evidence: [{ id: "evidence-1" }] };
    const bindDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue(authority) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerDocumentEvidence: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerDocumentVersion: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(document),
      },
    });
    await expect(repository(bindDb).bindEvidence({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      mediaFileId: "media-1", position: 0, canonicalContentType: "image/png", byteSize: 100,
      pageCount: null, actorUserId: "owner-1", commandId: "bind-command", requestId: "request-bind",
    })).resolves.toBe(document);

    const removeDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue(authority) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerDocumentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerDocumentEvidence: {
        findFirst: vi.fn().mockResolvedValue({ id: "evidence-1", mediaFileId: "media-1" }),
        delete: vi.fn().mockResolvedValue({}),
      },
    });
    await expect(repository(removeDb).removeEvidence({
      providerId: "provider-1", documentVersionId: "document-1", evidenceId: "evidence-1",
      expectedVersion: 2, actorUserId: "owner-1", commandId: "remove-command", requestId: "request-remove",
    })).resolves.toEqual({ mediaFileId: "media-1", version: 3 });

    const reorderDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue(authority) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerDocumentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerDocumentEvidence: {
        findMany: vi.fn().mockResolvedValue([
          { id: "evidence-1", canonicalContentType: "image/png" },
          { id: "evidence-2", canonicalContentType: "image/jpeg" },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    await expect(repository(reorderDb).reorderEvidence({
      providerId: "provider-1", documentVersionId: "document-1", evidenceIds: ["evidence-2", "evidence-1"],
      expectedVersion: 3, actorUserId: "owner-1", commandId: "reorder-command", requestId: "request-reorder",
    })).resolves.toEqual({ version: 4 });
    expect((reorderDb["providerDocumentEvidence"] as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledTimes(4);
  });

  it("submits an evidence-backed draft and creates a successor", async () => {
    const evidence = [{ mediaFileId: "media-1", canonicalContentType: "image/png", byteSize: 100, pageCount: null }];
    const submitted = { id: "document-1", providerId: "provider-1", status: "SUBMITTED", version: 2 };
    const submitDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      providerDocumentVersion: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(submitted),
        findFirst: vi.fn().mockResolvedValue({
          id: "document-1", providerId: "provider-1", status: "DRAFT", version: 1,
          countryCode: "EG", chain: { documentTypeId: "type-1" }, evidence,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      verificationDocumentPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: "policy-1", items: [{ id: "policy-item-1", fieldRules: { format: "IMAGE_SET" } }] }),
      },
    });
    await expect(repository(submitDb).submitDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      actorUserId: "owner-1", policyVersionId: "policy-1", policyItemId: "policy-item-1",
      policyRuleSnapshot: { format: "IMAGE_SET" }, evidenceFormat: "IMAGE_SET",
      commandId: "submit-command", requestId: "request-submit", now,
    })).resolves.toBe(submitted);

    const successor = { id: "document-2", providerId: "provider-1", predecessorVersionId: "document-1", sequence: 2 };
    const successorDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
      providerDocumentVersion: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: "document-1", providerId: "provider-1", chainId: "chain-1", sequence: 1,
            status: "APPROVED", version: 2, countryCode: "EG", documentNumber: "REG-001",
            legalName: "Synthetic Company", issuerName: "Registry Authority", issueDate, expiresAt,
          })
          .mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue(successor),
      },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    });
    await expect(repository(successorDb).createSuccessor({
      providerId: "provider-1", predecessorVersionId: "document-1", expectedVersion: 2,
      actorUserId: "owner-1", commandId: "successor-command", requestId: "request-successor",
    })).resolves.toBe(successor);
  });

  it.each([
    ["APPROVE", "SUBMITTED", "APPROVED"],
    ["REJECT", "SUBMITTED", "REJECTED"],
    ["REQUEST_REPLACEMENT", "SUBMITTED", "REPLACEMENT_REQUESTED"],
    ["INVALIDATE", "APPROVED", "INVALIDATED"],
  ] as const)("commits %s document decisions", async (outcome, status, target) => {
    const review = { id: `review-${outcome}`, outcome };
    const row = {
      id: "document-1", providerId: "provider-1", chainId: "chain-1", predecessorVersionId: outcome === "APPROVE" ? "document-0" : null,
      status, version: 3, expiresAt, documentNumber: "REG-001", legalName: "Synthetic Company", issuerName: "Registry Authority",
      evidence: [{ mediaFileId: "media-1", canonicalContentType: "image/png", byteSize: 100, pageCount: null }],
    };
    const db = transactionDatabase({
      providerDocumentReview: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(review) },
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
      providerDocumentVersion: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(row)
          .mockResolvedValue({ id: "document-0", version: 2 }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      providerDocumentChain: { update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerVerificationHistory: { create: vi.fn().mockResolvedValue({}) },
    });
    await expect(repository(db).decideDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 3,
      outcome, reason: "Reviewed against authoritative evidence", actorUserId: "staff-1",
      commandId: `decision-${outcome}`, requestId: `request-${outcome}`, now,
    })).resolves.toBe(review);
    const update = (db["providerDocumentVersion"] as { update: ReturnType<typeof vi.fn> }).update;
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: target }) }));
  });

  it("expires only rows that still match their approved version", async () => {
    const historyCreate = vi.fn().mockResolvedValue({});
    const db = transactionDatabase({
      providerDocumentVersion: {
        findMany: vi.fn().mockResolvedValue([
          { id: "document-1", chainId: "chain-1", providerId: "provider-1", version: 2 },
          { id: "document-2", chainId: "chain-2", providerId: "provider-2", version: 4 },
        ]),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }),
      },
      providerDocumentChain: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerVerificationHistory: { create: historyCreate },
    });
    await expect(repository(db).expireApproved(now, 500)).resolves.toBe(2);
    expect(historyCreate).toHaveBeenCalledTimes(1);
  });

  it("creates, replaces, and publishes a policy draft", async () => {
    const item = {
      documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true,
      position: 0, fieldRules: { format: "PDF" },
    } as const;
    const created = { id: "policy-1", status: "DRAFT", version: 1 };
    const createDb = transactionDatabase({
      verificationDocumentPolicyVersion: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ policyVersion: 2 }),
        create: vi.fn().mockResolvedValue(created),
      },
      country: { findFirst: vi.fn().mockResolvedValue({ id: "country-eg" }) },
      verificationDocumentType: { findMany: vi.fn().mockResolvedValue([{ id: "type-1", code: item.documentTypeCode }]) },
    });
    await expect(repository(createDb).createPolicyDraft({
      countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: now,
      actorUserId: "staff-1", commandId: "policy-create", items: [item],
    })).resolves.toBe(created);

    const replaced = { ...created, version: 2, items: [] };
    const replaceDb = transactionDatabase({
      verificationDocumentPolicyVersion: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ ...created, items: [] }),
        update: vi.fn().mockResolvedValue({}),
        findUniqueOrThrow: vi.fn().mockResolvedValue(replaced),
      },
      verificationDocumentType: { findMany: vi.fn().mockResolvedValue([{ id: "type-1", code: item.documentTypeCode }]) },
      verificationDocumentPolicyItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    });
    await expect(repository(replaceDb).replacePolicyDraft({
      policyVersionId: "policy-1", expectedVersion: 1, effectiveAt: now,
      actorUserId: "staff-1", commandId: "policy-replace", items: [item],
    })).resolves.toBe(replaced);

    const published = { ...replaced, status: "PUBLISHED" };
    const publishDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      verificationDocumentPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "policy-1", status: "DRAFT", version: 2, effectiveAt: now,
          country: { isActive: true }, items: [{ documentType: { isActive: true } }],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(published),
      },
    });
    await expect(repository(publishDb).publishPolicy({
      policyVersionId: "policy-1", expectedVersion: 2, actorUserId: "staff-1",
      reason: "Reviewed and approved policy", commandId: "policy-publish", now,
    })).resolves.toBe(published);
  });

  it("accepts exact document replays and rejects every material mutation", async () => {
    const createInput = {
      providerId: "provider-1", typeCode: "COMMERCIAL_REGISTRATION", countryCode: "EG",
      documentNumber: "REG-001", legalName: "Synthetic Company", issuerName: "Registry Authority",
      issueDate, expiresAt, actorUserId: "owner-1", commandId: "create-command", requestId: "request-create", now,
    };
    const created = {
      id: "document-1", providerId: "provider-1", status: "DRAFT", version: 1,
      countryCode: "EG", documentNumber: "REG-001", legalName: "Synthetic Company",
      issuerName: "Registry Authority", issueDate, expiresAt, createdByUserId: "owner-1",
      chain: { documentType: { code: "COMMERCIAL_REGISTRATION" } },
    };
    const createHistory = {
      event: "DOCUMENT_DRAFT_CREATED", documentVersionId: "document-1", providerId: "provider-1",
      actorUserId: "owner-1", requestId: "request-create", exactVersion: 1,
    };
    const createReplay = (row = created, history = createHistory) => repository({
      providerDocumentVersion: { findUnique: vi.fn().mockResolvedValue(row) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
    }).createDraft(createInput);
    await expect(createReplay()).resolves.toBe(created);
    const createVariants: Array<[Partial<typeof created>, Partial<typeof createHistory>]> = [
      [{}, { event: "DOCUMENT_DRAFT_UPDATED" }],
      [{}, { documentVersionId: "other" }],
      [{}, { providerId: "other" }],
      [{}, { actorUserId: "other" }],
      [{}, { requestId: "other" }],
      [{}, { exactVersion: 2 }],
      [{ providerId: "other" }, {}],
      [{ status: "SUBMITTED" }, {}],
      [{ version: 2 }, {}],
      [{ countryCode: "US" }, {}],
      [{ documentNumber: "OTHER" }, {}],
      [{ legalName: "Other Company" }, {}],
      [{ issuerName: "Other Issuer" }, {}],
      [{ issueDate: new Date(issueDate.getTime() + 1) }, {}],
      [{ expiresAt: new Date(expiresAt.getTime() + 1) }, {}],
      [{ createdByUserId: "other" }, {}],
    ];
    for (const [rowPatch, historyPatch] of createVariants) {
      await expect(createReplay({ ...created, ...rowPatch }, { ...createHistory, ...historyPatch }))
        .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    }

    const updateInput = {
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      countryCode: "EG", documentNumber: "REG-002", legalName: "Synthetic Company",
      issuerName: "Registry Authority", issueDate, expiresAt: null,
      actorUserId: "owner-1", commandId: "update-command", requestId: "request-update",
    };
    const updated = { ...created, version: 2, documentNumber: "REG-002", expiresAt: null };
    const updateHistory = {
      providerId: "provider-1", documentVersionId: "document-1", exactVersion: 1,
      actorUserId: "owner-1", requestId: "request-update",
    };
    const updateReplay = (row = updated, history = updateHistory) => repository({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
      providerDocumentVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(row) },
    }).updateDraft(updateInput);
    await expect(updateReplay()).resolves.toBe(updated);
    const updateVariants: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [{}, { providerId: "other" }], [{}, { documentVersionId: "other" }], [{}, { exactVersion: 2 }],
      [{}, { actorUserId: "other" }], [{}, { requestId: "other" }], [{ status: "SUBMITTED" }, {}],
      [{ version: 3 }, {}], [{ countryCode: "US" }, {}], [{ documentNumber: "OTHER" }, {}],
      [{ legalName: "Other" }, {}], [{ issuerName: "Other" }, {}],
      [{ issueDate: new Date(issueDate.getTime() + 1) }, {}], [{ expiresAt: expiresAt }, {}],
    ];
    for (const [rowPatch, historyPatch] of updateVariants) {
      await expect(updateReplay({ ...updated, ...rowPatch }, { ...updateHistory, ...historyPatch }))
        .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    }
  });

  it("validates exact evidence and submit replay fingerprints", async () => {
    const bindInput = {
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      mediaFileId: "media-1", position: 0, canonicalContentType: "image/png", byteSize: 100,
      pageCount: null, actorUserId: "owner-1", commandId: "bind-command", requestId: "request-bind",
    };
    const mutationTargetId = createHash("sha256")
      .update(JSON.stringify(["document-1", "media-1", 0, "image/png", 100, null]), "utf8")
      .digest("hex");
    const bindHistory = {
      event: "DOCUMENT_EVIDENCE_BOUND", providerId: "provider-1", documentVersionId: "document-1",
      exactVersion: 1, actorUserId: "owner-1", requestId: "request-bind", mutationTargetId,
    };
    const evidence = {
      documentVersionId: "document-1", mediaFileId: "media-1", position: 0,
      canonicalContentType: "image/png", byteSize: 100, pageCount: null,
      expectedDocumentVersion: 1, boundByUserId: "owner-1",
    };
    const boundDocument = { id: "document-1", evidence: [evidence] };
    const bindReplay = (history: Record<string, unknown> | null, row: Record<string, unknown> | null) => repository({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
      providerDocumentEvidence: { findUnique: vi.fn().mockResolvedValue(row) },
      providerDocumentVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(boundDocument) },
    }).bindEvidence(bindInput);
    await expect(bindReplay(bindHistory, evidence)).resolves.toBe(boundDocument);
    await expect(bindReplay(null, evidence)).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    await expect(bindReplay(bindHistory, null)).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    const bindHistoryFields = ["event", "providerId", "documentVersionId", "exactVersion", "actorUserId", "requestId", "mutationTargetId"] as const;
    for (const field of bindHistoryFields) {
      await expect(bindReplay({ ...bindHistory, [field]: "other" }, evidence)).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    }
    const evidenceFields = ["documentVersionId", "mediaFileId", "position", "canonicalContentType", "byteSize", "pageCount", "expectedDocumentVersion", "boundByUserId"] as const;
    for (const field of evidenceFields) {
      await expect(bindReplay(bindHistory, { ...evidence, [field]: field === "pageCount" ? 1 : "other" }))
        .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    }

    const submitInput = {
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      actorUserId: "owner-1", commandId: "submit-command", requestId: "request-submit",
    };
    const submitHistory = {
      event: "DOCUMENT_SUBMITTED", providerId: "provider-1", documentVersionId: "document-1",
      exactVersion: 1, actorUserId: "owner-1", requestId: "request-submit",
    };
    const submitted = {
      providerId: "provider-1", version: 2, submittedByUserId: "owner-1", submittedAt: now,
    };
    const submitReplay = (history = submitHistory, row = submitted) => repository({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
      providerDocumentVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(row) },
    }).findDocumentSubmitReplay(submitInput);
    await expect(submitReplay()).resolves.toBe(submitted);
    const submitVariants: Array<[Partial<typeof submitHistory>, Partial<typeof submitted>]> = [
      [{ event: "OTHER" }, {}], [{ providerId: "other" }, {}], [{ documentVersionId: "other" }, {}],
      [{ exactVersion: 2 }, {}], [{ actorUserId: "other" }, {}], [{ requestId: "other" }, {}],
      [{}, { providerId: "other" }], [{}, { version: 1 }], [{}, { submittedByUserId: "other" }], [{}, { submittedAt: null as never }],
    ];
    for (const [historyPatch, rowPatch] of submitVariants) {
      await expect(submitReplay({ ...submitHistory, ...historyPatch }, { ...submitted, ...rowPatch }))
        .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    }
  });

  it("validates exact removal, reorder, decision, successor, and policy replays", async () => {
    const removeInput = {
      providerId: "provider-1", documentVersionId: "document-1", evidenceId: "evidence-1",
      expectedVersion: 2, actorUserId: "owner-1", commandId: "remove-command", requestId: "request-remove",
    };
    const removeHistory = {
      event: "DOCUMENT_EVIDENCE_REMOVED", providerId: "provider-1", documentVersionId: "document-1",
      exactVersion: 2, actorUserId: "owner-1", requestId: "request-remove", mutationTargetId: "evidence-1|media-1",
    };
    const removeReplay = (history = removeHistory) => repository({ providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) } }).removeEvidence(removeInput);
    await expect(removeReplay()).resolves.toEqual({ mediaFileId: "media-1", version: 3 });
    for (const patch of [
      { event: "OTHER" }, { providerId: "other" }, { documentVersionId: "other" }, { exactVersion: 3 },
      { actorUserId: "other" }, { requestId: "other" }, { mutationTargetId: "bad" },
      { mutationTargetId: "other|media-1" }, { mutationTargetId: "evidence-1|" },
    ]) await expect(removeReplay({ ...removeHistory, ...patch })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");

    const reorderInput = {
      providerId: "provider-1", documentVersionId: "document-1", evidenceIds: ["evidence-2", "evidence-1"],
      expectedVersion: 3, actorUserId: "owner-1", commandId: "reorder-command", requestId: "request-reorder",
    };
    const reorderTarget = createHash("sha256").update(JSON.stringify(["document-1", "evidence-2", "evidence-1"]), "utf8").digest("hex");
    const reorderHistory = {
      event: "DOCUMENT_EVIDENCE_REORDERED", providerId: "provider-1", documentVersionId: "document-1",
      exactVersion: 3, actorUserId: "owner-1", requestId: "request-reorder", mutationTargetId: reorderTarget,
    };
    const reorderReplay = (history = reorderHistory) => repository({ providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) } }).reorderEvidence(reorderInput);
    await expect(reorderReplay()).resolves.toEqual({ version: 4 });
    for (const patch of [
      { event: "OTHER" }, { providerId: "other" }, { documentVersionId: "other" }, { exactVersion: 4 },
      { actorUserId: "other" }, { requestId: "other" }, { mutationTargetId: "other" },
    ]) await expect(reorderReplay({ ...reorderHistory, ...patch })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");

    const decisionInput = {
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 3,
      outcome: "APPROVE" as const, reason: "Reviewed against authoritative evidence", actorUserId: "staff-1",
      commandId: "decision-command", requestId: "request-decision",
    };
    const decision = {
      providerId: "provider-1", documentVersionId: "document-1", expectedDocumentVersion: 3,
      outcome: "APPROVE", reason: decisionInput.reason, actorUserId: "staff-1", requestId: "request-decision",
    };
    const decisionReplay = (row = decision) => repository({ providerDocumentReview: { findUnique: vi.fn().mockResolvedValue(row) } }).findDocumentDecisionReplay(decisionInput);
    await expect(decisionReplay()).resolves.toBe(decision);
    for (const patch of [
      { providerId: "other" }, { documentVersionId: "other" }, { expectedDocumentVersion: 4 }, { outcome: "REJECT" },
      { reason: "Other reason" }, { actorUserId: "other" }, { requestId: "other" },
    ]) await expect(decisionReplay({ ...decision, ...patch })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");

    const successorInput = {
      providerId: "provider-1", predecessorVersionId: "document-1", expectedVersion: 3,
      actorUserId: "owner-1", commandId: "successor-command", requestId: "request-successor",
    };
    const successor = { id: "document-2", providerId: "provider-1", predecessorVersionId: "document-1", createdByUserId: "owner-1", sequence: 2 };
    const successorHistory = {
      event: "DOCUMENT_DRAFT_CREATED", providerId: "provider-1", documentVersionId: "document-2",
      mutationTargetId: "document-1", exactVersion: 3, actorUserId: "owner-1", requestId: "request-successor",
    };
    const successorReplay = (row = successor, history = successorHistory) => repository({
      providerDocumentVersion: { findUnique: vi.fn().mockResolvedValue(row) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
    }).createSuccessor(successorInput);
    await expect(successorReplay()).resolves.toBe(successor);
    const successorVariants: Array<[Partial<typeof successor>, Partial<typeof successorHistory>]> = [
      [{}, { event: "OTHER" }], [{}, { providerId: "other" }], [{}, { documentVersionId: "other" }],
      [{}, { mutationTargetId: "other" }], [{}, { exactVersion: 4 }], [{}, { actorUserId: "other" }], [{}, { requestId: "other" }],
      [{ providerId: "other" }, {}], [{ predecessorVersionId: "other" }, {}], [{ createdByUserId: "other" }, {}], [{ sequence: 1 }, {}],
    ];
    for (const [rowPatch, historyPatch] of successorVariants) {
      await expect(successorReplay({ ...successor, ...rowPatch }, { ...successorHistory, ...historyPatch }))
        .rejects.toThrow("DOCUMENT_VERSION_CONFLICT");
    }

    const policyInput = {
      countryCode: "EG", providerKind: "REGISTERED_COMPANY" as const, effectiveAt: now,
      actorUserId: "staff-1", commandId: "policy-command",
      items: [{ documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: { format: "PDF" } }],
    };
    const policy = {
      country: { code: "EG" }, providerKind: "REGISTERED_COMPANY", effectiveAt: now, createdByUserId: "staff-1",
      items: [{ documentType: { code: "COMMERCIAL_REGISTRATION" }, isRequired: true, isActive: true, position: 0, fieldRules: { format: "PDF" } }],
    };
    const policyReplay = (row = policy) => repository({ verificationDocumentPolicyVersion: { findUnique: vi.fn().mockResolvedValue(row) } }).createPolicyDraft(policyInput);
    await expect(policyReplay()).resolves.toBe(policy);
    for (const patch of [
      { country: { code: "US" } }, { providerKind: "INDIVIDUAL" }, { effectiveAt: new Date(now.getTime() + 1) },
      { createdByUserId: "other" }, { items: [] },
    ]) await expect(policyReplay({ ...policy, ...patch })).rejects.toThrow("POLICY_VERSION_CONFLICT");

    const publishInput = {
      policyVersionId: "policy-1", expectedVersion: 2, actorUserId: "staff-1",
      reason: "Reviewed and approved policy", commandId: "publish-command",
    };
    const publishHistory = {
      event: "POLICY_PUBLISHED", policyVersionId: "policy-1", exactVersion: 2,
      actorUserId: "staff-1", reasonText: "Reviewed and approved policy",
    };
    const published = { id: "policy-1", status: "PUBLISHED" };
    const publishReplay = (history = publishHistory) => repository({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(history) },
      verificationDocumentPolicyVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(published) },
    }).findPolicyPublishReplay(publishInput);
    await expect(publishReplay()).resolves.toBe(published);
    for (const patch of [
      { event: "OTHER" }, { policyVersionId: "other" }, { exactVersion: 3 }, { actorUserId: "other" }, { reasonText: "Other" },
    ]) await expect(publishReplay({ ...publishHistory, ...patch })).rejects.toThrow("POLICY_VERSION_CONFLICT");
  });

  it("honors exact transaction-local replays for submit, decision, replace, and publish", async () => {
    const submitted = { id: "document-1", status: "SUBMITTED", version: 2, policyVersionId: "policy-1", policyItemId: "item-1", evidenceFormat: "PDF" };
    const submitPrior = {
      providerId: "provider-1", documentVersionId: "document-1", policyVersionId: "policy-1",
      exactVersion: 1, actorUserId: "owner-1", requestId: "request-submit",
    };
    const submitDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(submitPrior) },
      providerDocumentVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(submitted) },
    });
    await expect(repository(submitDb).submitDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      actorUserId: "owner-1", policyVersionId: "policy-1", policyItemId: "item-1",
      policyRuleSnapshot: { format: "PDF" }, evidenceFormat: "PDF", commandId: "submit-command", requestId: "request-submit", now,
    })).resolves.toBe(submitted);

    const decisionPrior = {
      providerId: "provider-1", documentVersionId: "document-1", expectedDocumentVersion: 3,
      outcome: "APPROVE", reason: "Reviewed against authoritative evidence", actorUserId: "staff-1", requestId: "request-decision",
    };
    const decisionDb = transactionDatabase({
      providerDocumentReview: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(decisionPrior) },
    });
    await expect(repository(decisionDb).decideDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 3,
      outcome: "APPROVE", reason: "Reviewed against authoritative evidence", actorUserId: "staff-1",
      commandId: "decision-command", requestId: "request-decision", now,
    })).resolves.toBe(decisionPrior);

    const item = {
      documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true,
      position: 0, fieldRules: { format: "PDF" },
    } as const;
    const retryKey = "policy-1:replace:replace-command";
    const lockedPolicy = {
      id: "policy-1", version: 2, effectiveAt: now, lastMutationKey: retryKey,
      lastMutationActorUserId: "staff-1",
      items: [{ documentType: { code: item.documentTypeCode }, isRequired: true, isActive: true, position: 0, fieldRules: item.fieldRules }],
    };
    const replaceDb = transactionDatabase({
      verificationDocumentPolicyVersion: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(lockedPolicy),
      },
    });
    await expect(repository(replaceDb).replacePolicyDraft({
      policyVersionId: "policy-1", expectedVersion: 1, effectiveAt: now,
      actorUserId: "staff-1", commandId: "replace-command", items: [item],
    })).resolves.toBe(lockedPolicy);

    const published = { id: "policy-1", status: "PUBLISHED" };
    const publishPrior = { policyVersionId: "policy-1", exactVersion: 2, actorUserId: "staff-1", reasonText: "Reviewed policy" };
    const publishDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(publishPrior) },
      verificationDocumentPolicyVersion: { findUniqueOrThrow: vi.fn().mockResolvedValue(published) },
    });
    await expect(repository(publishDb).publishPolicy({
      policyVersionId: "policy-1", expectedVersion: 2, actorUserId: "staff-1",
      reason: "Reviewed policy", commandId: "publish-command", now,
    })).resolves.toBe(published);
  });

  it("fails closed on authority, evidence, policy, and optimistic-write gaps", async () => {
    const rawRepository = (database: Record<string, unknown>) => new PrismaProviderVerificationRepository(database as never);

    const deniedDraftDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue(null) },
      providerDocumentVersion: { findUnique: vi.fn().mockResolvedValue(null) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(repository(deniedDraftDb).createDraft({
      providerId: "provider-1", typeCode: "COMMERCIAL_REGISTRATION", countryCode: "EG",
      documentNumber: "REG-001", legalName: "Synthetic Company", issuerName: "Registry Authority",
      issueDate, expiresAt, actorUserId: "owner-1", commandId: "denied-draft", requestId: "request-denied", now,
    })).rejects.toThrow("PROVIDER_SCOPE_DENIED");

    const changedDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      providerDocumentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    });
    await expect(repository(changedDb).updateDraft({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      countryCode: "EG", documentNumber: "REG-001", legalName: "Synthetic Company",
      issuerName: "Registry Authority", issueDate, expiresAt, actorUserId: "owner-1",
      commandId: "stale-update", requestId: "request-stale",
    })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");

    const badEvidenceShapes = [
      [{ id: "evidence-1", canonicalContentType: "image/png" }],
      [{ id: "other", canonicalContentType: "image/png" }, { id: "evidence-2", canonicalContentType: "image/jpeg" }],
      [{ id: "evidence-1", canonicalContentType: "application/pdf" }, { id: "evidence-2", canonicalContentType: "image/jpeg" }],
    ];
    for (const evidenceRows of badEvidenceShapes) {
      const reorderDb = transactionDatabase({
        provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
        providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
        providerDocumentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        providerDocumentEvidence: { findMany: vi.fn().mockResolvedValue(evidenceRows) },
      });
      await expect(repository(reorderDb).reorderEvidence({
        providerId: "provider-1", documentVersionId: "document-1", evidenceIds: ["evidence-1", "evidence-2"],
        expectedVersion: 1, actorUserId: "owner-1", commandId: `bad-reorder-${evidenceRows.length}-${evidenceRows[0]?.canonicalContentType}`,
        requestId: "request-reorder",
      })).rejects.toThrow("DOCUMENT_EVIDENCE_INVALID");
    }
    const duplicateInputDb = transactionDatabase({
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1", profile: { countryId: "country-eg" } }) },
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      providerDocumentVersion: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      providerDocumentEvidence: {
        findMany: vi.fn().mockResolvedValue([
          { id: "evidence-1", canonicalContentType: "image/png" },
          { id: "evidence-2", canonicalContentType: "image/jpeg" },
        ]),
      },
    });
    await expect(repository(duplicateInputDb).reorderEvidence({
      providerId: "provider-1", documentVersionId: "document-1", evidenceIds: ["evidence-1", "evidence-1"],
      expectedVersion: 1, actorUserId: "owner-1", commandId: "bad-reorder-duplicate", requestId: "request-reorder",
    })).rejects.toThrow("DOCUMENT_EVIDENCE_INVALID");

    const noEvidenceDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      providerDocumentVersion: { findFirst: vi.fn().mockResolvedValue({ evidence: [] }) },
    });
    await expect(repository(noEvidenceDb).submitDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      actorUserId: "owner-1", policyVersionId: "policy-1", policyItemId: "item-1",
      policyRuleSnapshot: {}, evidenceFormat: "PDF", commandId: "no-evidence", requestId: "request-submit", now,
    })).rejects.toThrow("DOCUMENT_VERSION_CONFLICT");

    const evidenceNotReadyDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      providerDocumentVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "document-1", countryCode: "EG", chain: { documentTypeId: "type-1" },
          evidence: [{ mediaFileId: "media-1", canonicalContentType: "image/png", byteSize: 100, pageCount: null }],
        }),
      },
    });
    await expect(rawRepository(evidenceNotReadyDb).submitDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      actorUserId: "owner-1", policyVersionId: "policy-1", policyItemId: "item-1",
      policyRuleSnapshot: {}, evidenceFormat: "IMAGE_SET", commandId: "not-ready", requestId: "request-submit", now,
    })).rejects.toThrow("DOCUMENT_EVIDENCE_NOT_READY");

    const staffDeniedDb = transactionDatabase({
      providerDocumentReview: { findUnique: vi.fn().mockResolvedValue(null) },
      provider: { findFirst: vi.fn().mockResolvedValue({ id: "provider-1" }) },
    });
    await expect(rawRepository(staffDeniedDb).decideDocument({
      providerId: "provider-1", documentVersionId: "document-1", expectedVersion: 1,
      outcome: "REJECT", reason: "Reviewed against authoritative evidence", actorUserId: "staff-1",
      commandId: "staff-denied", requestId: "request-decision", now,
    })).rejects.toThrow("PROVIDER_SCOPE_DENIED");

    const invalidPolicyDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null) },
      verificationDocumentPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({ id: "policy-1", effectiveAt: null, country: { isActive: true }, items: [] }),
      },
    });
    await expect(repository(invalidPolicyDb).publishPolicy({
      policyVersionId: "policy-1", expectedVersion: 1, actorUserId: "staff-1",
      reason: "Reviewed policy", commandId: "invalid-policy", now,
    })).rejects.toThrow("POLICY_VERSION_CONFLICT");

    const stalePolicyDb = transactionDatabase({
      providerVerificationHistory: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      verificationDocumentPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "policy-1", effectiveAt: now, country: { isActive: true }, items: [{ documentType: { isActive: true } }],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });
    await expect(repository(stalePolicyDb).publishPolicy({
      policyVersionId: "policy-1", expectedVersion: 1, actorUserId: "staff-1",
      reason: "Reviewed policy", commandId: "stale-policy", now,
    })).rejects.toThrow("POLICY_VERSION_CONFLICT");
  });
});
