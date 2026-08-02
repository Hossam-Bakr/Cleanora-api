import { loadEnvironment } from "#config/env";
import {
  EmailDeliveryError,
  createNodemailerEmailAdapter,
} from "../src/integrations/email/nodemailer.adapter.js";

async function checkEmail(): Promise<void> {
  let environment;
  try {
    environment = loadEnvironment(process.env);
  } catch {
    process.stderr.write("FAIL EMAIL_CONFIGURATION_INVALID\n");
    process.exitCode = 1;
    return;
  }

  if (!environment.AUTH_ENABLED || !environment.EMAIL_AUTH_ENABLED) {
    process.stderr.write("FAIL EMAIL_AUTH_DISABLED\n");
    process.exitCode = 1;
    return;
  }

  try {
    const adapter = createNodemailerEmailAdapter({
      host: environment.SMTP_HOST!,
      port: environment.SMTP_PORT!,
      secure: environment.SMTP_SECURE!,
      requireTls: environment.SMTP_REQUIRE_TLS!,
      user: environment.SMTP_USER!,
      password: environment.SMTP_PASSWORD!,
      fromName: environment.SMTP_FROM_NAME!,
      fromEmail: environment.SMTP_FROM_EMAIL!,
      connectionTimeoutMilliseconds: environment.SMTP_CONNECTION_TIMEOUT_MS!,
      socketTimeoutMilliseconds: environment.SMTP_SOCKET_TIMEOUT_MS!,
    });
    await adapter.verify();
    process.stdout.write("PASS\n");
  } catch (error) {
    const safeName =
      error instanceof EmailDeliveryError
        ? error.name
        : "EMAIL_PROVIDER_UNAVAILABLE";
    process.stderr.write(`FAIL ${safeName}\n`);
    process.exitCode = 1;
  }
}

void checkEmail();
