import type { PaymentGatewayPort } from "./payment-gateway.port.js";
import { paymentsError } from "../payments.errors.js";

/**
 * @desc Fail-closed gateway used when Paymob env secrets are incomplete.
 * @access Composition
 */
export class MisconfiguredPaymentGateway implements PaymentGatewayPort {
  public readonly provider = "PAYMOB" as const;

  public async createDepositSession(
    _input: import("./payment-gateway.port.js").CreateDepositSessionInput,
  ): Promise<never> {
    throw paymentsError("GATEWAY_MISCONFIGURED");
  }

  public verifyWebhookSignature(_input: {
    readonly rawBody: Buffer;
    readonly signatureHeader: string | undefined;
  }): boolean {
    return false;
  }

  public parseWebhookEvent(_input: {
    readonly rawBody: Buffer;
  }): never {
    throw paymentsError("GATEWAY_MISCONFIGURED");
  }
}
