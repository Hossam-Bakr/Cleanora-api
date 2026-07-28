import { getPrismaClient } from "#integrations/database/index";
import type { SessionRevocationReason } from "#generated/prisma/client";
import type {
  AuthenticationMethod,
  SessionCapability,
} from "../domain/authentication.types.js";

export class SessionRepository {
  create(data: {
    id: string;
    userId: string;
    verifier: string;
    credentialVersion: number;
    method: AuthenticationMethod;
    capability: SessionCapability;
    expiresAt: Date;
  }) {
    return getPrismaClient().userSession.create({
      data: {
        id: data.id,
        userId: data.userId,
        currentRefreshVerifier: data.verifier,
        credentialVersion: data.credentialVersion,
        authenticationMethod: data.method,
        capability: data.capability,
        expiresAt: data.expiresAt,
      },
    });
  }
  find(id: string) {
    return getPrismaClient().userSession.findUnique({ where: { id } });
  }
  async rotate(id: string, expected: string, next: string) {
    const result = await getPrismaClient().userSession.updateMany({
      where: {
        id,
        currentRefreshVerifier: expected,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        currentRefreshVerifier: next,
        rotationCounter: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
    return result.count === 1;
  }
  revoke(id: string, reason: SessionRevocationReason = "LOGOUT") {
    return getPrismaClient().userSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason },
    });
  }
  revokeAll(
    userId: string,
    reason: SessionRevocationReason,
    exceptId?: string,
  ) {
    return getPrismaClient().userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptId === undefined ? {} : { id: { not: exceptId } }),
      },
      data: { revokedAt: new Date(), revocationReason: reason },
    });
  }
  compromise(id: string) {
    return getPrismaClient().userSession.updateMany({
      where: { id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        compromisedAt: new Date(),
        revocationReason: "REFRESH_REUSE",
      },
    });
  }
}
