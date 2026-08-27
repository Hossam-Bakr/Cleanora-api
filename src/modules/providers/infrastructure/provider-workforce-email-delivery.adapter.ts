import type { EmailMessage, EmailPort } from "#integrations/email/email.types";
import type { WorkerIdentityReader } from "#modules/authentication/authentication.public";

import type { WorkerInvitationSnapshot } from "../domain/provider-workforce.types.js";
import type { WorkerInvitationProofPort } from "../domain/worker-invitation-proof.policy.js";
import type { ProviderWorkforceNotificationDeliveryPort } from "../provider-workforce-notification.dispatcher.js";
import type { LeasedWorkforceNotification } from "./prisma-provider-workforce-notification.repository.js";

const copy = {
  AR: {
    INVITATION_ISSUED: ["دعوة عمل من Cleanora", "لديك دعوة للانضمام كعامل. افتح صفحة الدعوة ثم استخدم رمز الدعوة أدناه خلال مدة صلاحيته."],
    LOGIN_ACCESS_ACTIVATED: ["تم تفعيل دخول العامل", "تم تفعيل دخولك كعامل لدى مقدم الخدمة."],
    LOGIN_ACCESS_RESET: ["تمت إعادة ضبط دخول العامل", "تمت إعادة ضبط دخولك كعامل. استخدم أحدث دعوة فقط."],
    LOGIN_ACCESS_REVOKED: ["تم إلغاء دخول العامل", "تم إلغاء وصولك كعامل لدى مقدم الخدمة."],
    WORKER_ACTIVATED: ["تم تفعيل حالة العامل", "تم تفعيل حالتك التشغيلية لدى مقدم الخدمة."],
    WORKER_DEACTIVATED: ["تم إيقاف حالة العامل", "تم إيقاف حالتك التشغيلية لدى مقدم الخدمة."],
    WORKER_REMOVED: ["انتهى ارتباط العامل", "أنهى مقدم الخدمة ارتباط العامل. حساب Cleanora المشترك لم يُعطّل."],
    WORKER_DEPARTED: ["غادر عامل مقدم الخدمة", "غادر عامل ارتباط مقدم الخدمة بنجاح."],
    PROVIDER_ADMIN_GRANTED: ["تم منح صلاحية مسؤول مقدم الخدمة", "تم منحك صلاحية مسؤول مقدم الخدمة."],
    PROVIDER_ADMIN_REVOKED: ["تم إلغاء صلاحية مسؤول مقدم الخدمة", "تم إلغاء صلاحية مسؤول مقدم الخدمة."],
  },
  EN: {
    INVITATION_ISSUED: ["Cleanora Worker invitation", "You have been invited to join as a Worker. Open the invitation page and use the invitation proof below before it expires."],
    LOGIN_ACCESS_ACTIVATED: ["Worker access activated", "Your Worker access for the Provider has been activated."],
    LOGIN_ACCESS_RESET: ["Worker access reset", "Your Worker access was reset. Use only the latest invitation."],
    LOGIN_ACCESS_REVOKED: ["Worker access revoked", "Your Worker access for the Provider was revoked."],
    WORKER_ACTIVATED: ["Worker status activated", "Your operational Worker status was activated."],
    WORKER_DEACTIVATED: ["Worker status deactivated", "Your operational Worker status was deactivated."],
    WORKER_REMOVED: ["Worker engagement ended", "The Provider ended the Worker engagement. Your shared Cleanora account was not disabled."],
    WORKER_DEPARTED: ["A Worker left the Provider", "A Worker successfully left the Provider engagement."],
    PROVIDER_ADMIN_GRANTED: ["Provider Admin access granted", "Provider Admin authority was granted to you."],
    PROVIDER_ADMIN_REVOKED: ["Provider Admin access revoked", "Provider Admin authority was revoked."],
  },
} as const;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export class ProviderWorkforceEmailDeliveryAdapter implements ProviderWorkforceNotificationDeliveryPort {
  public constructor(private readonly dependencies: {
    readonly email: EmailPort;
    readonly identityReader: WorkerIdentityReader;
    readonly invitationProof: WorkerInvitationProofPort;
    readonly readInvitation: (invitationId: string) => Promise<WorkerInvitationSnapshot | null>;
    readonly invitationAcceptPath: string;
  }) {}

  public async deliver(input: LeasedWorkforceNotification): Promise<void> {
    const to = input.recipientEmailNormalized
      ?? (input.recipientUserId === null
        ? null
        : (await this.dependencies.identityReader.getIdentity(input.recipientUserId))?.emailNormalized ?? null);
    if (to === null) throw new Error("WORKFORCE_NOTIFICATION_RECIPIENT_UNAVAILABLE");
    const [subject, baseText] = copy[input.locale][input.template];
    let invitationProof: string | null = null;
    if (input.template === "INVITATION_ISSUED") {
      if (input.invitationId === null) throw new Error("WORKFORCE_INVITATION_DELIVERY_INVALID");
      const invitation = await this.dependencies.readInvitation(input.invitationId);
      if (invitation?.status !== "PENDING") throw new Error("WORKFORCE_INVITATION_DELIVERY_INVALID");
      invitationProof = this.dependencies.invitationProof.issue({
        invitationId: invitation.id,
        invitationVersion: invitation.invitationVersion,
        emailNormalized: invitation.emailNormalized,
        locale: invitation.locale,
        expiresAt: invitation.expiresAt,
      });
    }
    const proofText = invitationProof === null
      ? ""
      : `\n\n${this.dependencies.invitationAcceptPath}\n\nInvitation proof:\n${invitationProof}`;
    const proofHtml = invitationProof === null
      ? ""
      : `<p><a href="${escapeHtml(this.dependencies.invitationAcceptPath)}">Open Cleanora</a></p><p>Invitation proof:</p><p>${escapeHtml(invitationProof)}</p>`;
    const message: EmailMessage = {
      to: [to],
      subject,
      text: `${baseText}${proofText}`,
      html: `<p>${escapeHtml(baseText)}</p>${proofHtml}`,
      idempotencyKey: input.idempotencyKey,
    };
    await this.dependencies.email.send(message);
  }
}
