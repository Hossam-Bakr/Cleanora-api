import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";

import type { AuthenticationProofConsumptionPort } from "./provider-sensitive-action-proof.verifier.js";
import type {
  ProviderServiceStaffPermissionCode,
  R1P06StaffPermissionCode,
} from "../authentication.public.js";

interface SignedProofClaims {
  readonly proofId: string;
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly purpose: string;
  readonly providerId: string;
  readonly destinationVersionId: string;
  readonly requestId: string;
  readonly authenticatedAt: string;
}

function parseSignedProof(token: string, secret: string): SignedProofClaims | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (payload === undefined || signature === undefined) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof claims !== "object" || claims === null || Array.isArray(claims)) return null;
    const row = claims as Record<string, unknown>;
    const keys = ["proofId", "actorUserId", "sessionId", "purpose", "providerId", "destinationVersionId", "requestId", "authenticatedAt"];
    if (keys.some((key) => typeof row[key] !== "string" || (row[key] as string).length === 0)) return null;
    return row as unknown as SignedProofClaims;
  } catch { return null; }
}

/** Authentication-owned validation for request/purpose-bound opaque proofs. */
export class PrismaAuthenticationProofConsumption implements AuthenticationProofConsumptionPort {
  public constructor(
    private readonly verifierSecret: string,
    private readonly db = getPrismaClient(),
  ) {}

  public async consume(input: Parameters<AuthenticationProofConsumptionPort["consume"]>[0]) {
    const claims = parseSignedProof(input.opaqueProof, this.verifierSecret);
    if (
      claims === null ||
      claims.actorUserId !== input.actorUserId ||
      claims.sessionId !== input.sessionId ||
      claims.purpose !== input.purpose ||
      claims.providerId !== input.providerId ||
      claims.destinationVersionId !== input.destinationVersionId ||
      claims.requestId !== input.requestId
    ) return null;
    const authenticatedAt = new Date(claims.authenticatedAt);
    if (Number.isNaN(authenticatedAt.getTime())) return null;
    try {
      return await this.db.$transaction(async (transaction) => {
        const session = await transaction.userSession.findFirst({
          where: {
            id: input.sessionId,
            userId: input.actorUserId,
            capability: "FULL",
            revokedAt: null,
            compromisedAt: null,
            expiresAt: { gt: new Date() },
            user: { status: "ACTIVE" },
          },
          select: { id: true },
        });
        if (session === null) return null;
        await transaction.sensitiveActionProofUse.create({
          data: {
            proofIdHash: createHash("sha256").update(claims.proofId).digest("hex"),
            actorUserId: input.actorUserId,
            sessionId: input.sessionId,
            purpose: input.purpose,
            providerId: input.providerId,
            destinationVersionId: input.destinationVersionId,
            requestId: input.requestId,
            authenticatedAt,
          },
        });
        return { proofId: claims.proofId, authenticatedAt };
      });
    } catch {
      // Unique proof-hash collision is the expected one-use denial. Other
      // persistence failures also fail closed without exposing internals.
      return null;
    }
  }
}

export class PrismaR1P06StaffPermissionAuthorizer {
  public constructor(
    private readonly db: Prisma.TransactionClient | ReturnType<typeof getPrismaClient> = getPrismaClient(),
  ) {}

  public async authorize(
    actorUserId: string,
    permission: R1P06StaffPermissionCode | ProviderServiceStaffPermissionCode,
  ): Promise<boolean> {
    const grant = await this.db.userRole.findFirst({
      where: {
        userId: actorUserId,
        status: "ENABLED",
        user: { status: "ACTIVE" },
        role: {
          code: "staff_admin",
          rolePermissions: { some: { permission: { code: permission } } },
        },
      },
      select: { id: true },
    });
    return grant !== null;
  }
}

/**
 * @desc Authorize Staff Admin Provider service price approval inside a transaction.
 * @explanation Mirrors the R1-P06 staff authorizer so Providers UoW can re-check
 * `providers.services.prices.approve` without importing Authentication internals.
 */
export class PrismaProviderServiceStaffAuthorizer {
  public constructor(
    private readonly db: Prisma.TransactionClient | ReturnType<typeof getPrismaClient> = getPrismaClient(),
  ) {}

  public async authorize(
    actorUserId: string,
    permission: ProviderServiceStaffPermissionCode,
  ): Promise<boolean> {
    return new PrismaR1P06StaffPermissionAuthorizer(this.db).authorize(
      actorUserId,
      permission,
    );
  }
}

export class PrismaAuthenticationProofUseAuthorizer {
  public constructor(
    private readonly db: Prisma.TransactionClient | ReturnType<typeof getPrismaClient> = getPrismaClient(),
  ) {}

  public async assertConsumed(input: {
    readonly proofId: string;
    readonly actorUserId: string;
    readonly purpose: string;
    readonly providerId: string;
    readonly destinationVersionId: string;
    readonly requestId: string;
    readonly maximumAgeSeconds: 600 | 300;
    readonly now: Date;
  }): Promise<boolean> {
    const earliestAcceptedAt = new Date(input.now.getTime() - input.maximumAgeSeconds * 1000);
    const use = await this.db.sensitiveActionProofUse.findFirst({
      where: {
        proofIdHash: createHash("sha256").update(input.proofId).digest("hex"),
        actorUserId: input.actorUserId,
        purpose: input.purpose as never,
        providerId: input.providerId,
        destinationVersionId: input.destinationVersionId,
        requestId: input.requestId,
        authenticatedAt: { gte: earliestAcceptedAt, lte: input.now },
      },
      select: { id: true },
    });
    return use !== null;
  }
}
