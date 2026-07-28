import { getPrismaClient } from "#integrations/database/index";
import { Prisma } from "#generated/prisma/client";
import type { AccountCategory } from "../domain/authentication.types.js";
import { authenticationError } from "../domain/authentication.errors.js";

export class OtpRepository {
  async create(data: {
    id: string;
    userId: string;
    category: AccountCategory;
    purpose: "CATEGORY_VERIFICATION" | "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION";
    channel: "SMS" | "EMAIL";
    destinationHash: string;
    verifier: string;
    expiresAt: Date;
    resendAt: Date;
    maxAttempts: number;
  }) {
    const now = new Date();
    try {
      return await getPrismaClient().$transaction(
        async (transaction) => {
          const coolingDown = await transaction.otpCode.findFirst({
            where: {
              userId: data.userId,
              accountCategory: data.category,
              purpose: data.purpose,
              status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
              expiresAt: { gt: now },
              resendAvailableAt: { gt: now },
            },
            orderBy: { createdAt: "desc" },
          });
          if (coolingDown !== null)
            return { challenge: coolingDown, created: false as const };
          await transaction.otpCode.updateMany({
            where: {
              userId: data.userId,
              accountCategory: data.category,
              purpose: data.purpose,
              status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
            },
            data: { status: "SUPERSEDED", supersededAt: now },
          });
          const challenge = await transaction.otpCode.create({
            data: {
              id: data.id,
              userId: data.userId,
              accountCategory: data.category,
              purpose: data.purpose,
              channel: data.channel,
              destinationHash: data.destinationHash,
              codeVerifier: data.verifier,
              expiresAt: data.expiresAt,
              resendAvailableAt: data.resendAt,
              maxAttempts: data.maxAttempts,
            },
          });
          return { challenge, created: true as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2034")
      ) {
        const winner = await getPrismaClient().otpCode.findFirst({
          where: {
            userId: data.userId,
            accountCategory: data.category,
            purpose: data.purpose,
            status: { in: ["PENDING_DELIVERY", "ACTIVE"] },
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
        });
        if (winner !== null)
          return { challenge: winner, created: false as const };
        throw authenticationError("AUTH_VERIFICATION_FAILED");
      }
      throw error;
    }
  }
  activate(id: string) {
    return getPrismaClient().otpCode.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "ACTIVE", deliveredAt: new Date() },
    });
  }
  failDelivery(id: string) {
    return getPrismaClient().otpCode.updateMany({
      where: { id, status: "PENDING_DELIVERY" },
      data: { status: "DELIVERY_FAILED", deliveryFailedAt: new Date() },
    });
  }
  findOpenForUser(
    userId: string,
    category: AccountCategory,
    purpose: "CATEGORY_VERIFICATION" | "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION",
    status: "DELIVERY_FAILED",
  ) {
    return getPrismaClient().otpCode.findFirst({
      where: { userId, accountCategory: category, purpose, status },
      orderBy: { createdAt: "desc" },
    });
  }
  find(id: string) {
    return getPrismaClient().otpCode.findUnique({ where: { id } });
  }
  consume(id: string) {
    return getPrismaClient().otpCode.updateMany({
      where: { id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      data: { status: "CONSUMED", consumedAt: new Date() },
    });
  }
  async failAttempt(id: string, exhausted: boolean) {
    return getPrismaClient().otpCode.update({
      where: { id },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        ...(exhausted ? { status: "EXHAUSTED" } : {}),
      },
    });
  }
}
