import { getPrismaClient } from "#integrations/database/index";
import { authenticationError } from "../domain/authentication.errors.js";
import { createHmac } from "node:crypto";

export class AuthEventRepository {
  constructor(private readonly privacySecret: string) {}
 
 
  async append(input: {
    userId?: string;
    sessionId?: string;
    eventType: string;
    outcome: "SUCCEEDED" | "FAILED" | "DENIED";
    reasonCode?: string;
    requestId?: string;
    context?: Record<string, string>;
    identifier?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const { identifier, ip, userAgent, ...safe } = input;
    const hash = (domain: string, value: string) =>
      createHmac("sha256", this.privacySecret)
        .update(`${domain}:${value}`)
        .digest("hex");
    try {
      return await getPrismaClient().authEvent.create({
        data: {
          ...safe,
          ...(identifier === undefined
            ? {}
            : { identifierHash: hash("identifier", identifier) }),
          ...(ip === undefined ? {} : { ipHash: hash("ip", ip) }),
          ...(userAgent === undefined
            ? {}
            : { userAgentHash: hash("user-agent", userAgent) }),
        },
      });
    } catch {
      throw authenticationError("AUTH_EVENT_WRITE_FAILED");
    }
  }
}
