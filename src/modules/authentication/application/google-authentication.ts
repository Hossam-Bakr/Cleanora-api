import { randomBytes } from "node:crypto";
import type {
  GoogleIdentityPort,
  GoogleTransactionStorePort,
} from "../domain/authentication.ports.js";
import { authenticationError } from "../domain/authentication.errors.js";
import type { AuthenticationPrincipal } from "../domain/authentication.types.js";
import type { AuthenticationService } from "./authentication.service.js";

export class GoogleAuthenticationService {
  constructor(
    private readonly identity: GoogleIdentityPort,
    private readonly transactions: GoogleTransactionStorePort,
    private readonly authentication: AuthenticationService,
  ) {}
  async start(intent: "SIGN_IN" | "LINK", principal?: AuthenticationPrincipal) {
    if (
      intent === "LINK" &&
      (principal === undefined ||
        principal.verificationOnly ||
        !principal.verifiedCategories.includes("INDIVIDUAL"))
    )
      throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
    const transaction = {
      state: randomBytes(32).toString("base64url"),
      nonce: randomBytes(32).toString("base64url"),
      pkceVerifier: randomBytes(32).toString("base64url"),
      intent,
      ...(principal === undefined
        ? {}
        : { userId: principal.userId, sessionId: principal.sessionId }),
      expiresAt: new Date(Date.now() + 600_000),
    } as const;
    this.transactions.save(transaction);
    return {
      state: transaction.state,
      authorizationUrl: await this.identity.createAuthorizationUrl(transaction),
    };
  }

  async callback(state: string, callbackUrl: string) {
    const transaction = this.transactions.consume(state);
    if (transaction === undefined)
      throw authenticationError("AUTH_SOCIAL_AUTHENTICATION_FAILED");
    const provider = await this.identity.consumeCallback(
      callbackUrl,
      transaction,
    );

    if (transaction.intent === "LINK") {
      if (
        transaction.userId === undefined ||
        transaction.sessionId === undefined
      ) {
        throw authenticationError("AUTH_SOCIAL_LINK_FAILED");
      }
      const principal = await this.authentication.resolveGoogleLinkPrincipal(
        transaction.userId,
        transaction.sessionId,
      );
      return {
        intent: "LINK" as const,
        result: await this.authentication.linkGoogle(principal, provider),
      };
    }

    return {
      intent: "SIGN_IN" as const,
      result: await this.authentication.googleSignIn(provider),
    };
  }
}
