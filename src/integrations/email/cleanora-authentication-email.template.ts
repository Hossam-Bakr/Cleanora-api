export interface CleanoraAuthenticationEmailTemplateInput {
  readonly preheader: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly introduction: string;
  readonly credentialLabel: string;
  readonly credentialValue: string;
  readonly accountCategory: string;
  readonly purpose: string;
  readonly destinationLabel: string;
  readonly destination: string;
  readonly expiresAt: string;
  readonly instruction: string;
  readonly securityNotice: string;
  readonly referenceId?: string;
  readonly developmentOnly?: boolean;
}

export interface RenderedAuthenticationEmail {
  readonly text: string;
  readonly html: string;
}

const colors = {
  forest: "#074C43",
  teal: "#168675",
  mint: "#E8F5F0",
  canvas: "#F4FAF7",
  yellow: "#F5C84C",
  ink: "#173A37",
  body: "#496663",
  line: "#D7E7E2",
  white: "#FFFFFF",
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function friendlyCategory(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function informationRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:${colors.body};font-size:13px;line-height:20px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0 8px 18px;color:${colors.ink};font-size:13px;font-weight:700;line-height:20px;text-align:right;vertical-align:top;word-break:break-word;">${escapeHtml(value)}</td>
  </tr>`;
}

/**
 * Build one responsive, email-client-safe Cleanora authentication message.
 *
 * Presentation tables and inline styles keep the hierarchy reliable in Gmail,
 * Outlook, Apple Mail, and mobile clients without loading external assets.
 */
export function renderCleanoraAuthenticationEmail(
  input: CleanoraAuthenticationEmailTemplateInput,
): RenderedAuthenticationEmail {
  const rows = [
    informationRow("Account type", friendlyCategory(input.accountCategory)),
    informationRow("Purpose", input.purpose),
    informationRow(input.destinationLabel, input.destination),
    informationRow("Expires", input.expiresAt),
    ...(input.referenceId === undefined
      ? []
      : [informationRow("Reference ID", input.referenceId)]),
  ].join("");
  const letterSpacing =
    input.credentialLabel === "Verification code" ? "8px" : "0";
  const developmentBanner =
    input.developmentOnly === true
      ? `<tr><td style="padding:0 38px 18px;"><span style="display:inline-block;padding:7px 12px;border-radius:999px;background:${colors.yellow};color:${colors.forest};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Development only</span></td></tr>`
      : "";

  const text = [
    "CLEANORA",
    ...(input.developmentOnly === true ? ["DEVELOPMENT ONLY"] : []),
    input.heading,
    "",
    input.introduction,
    "",
    `${input.credentialLabel}: ${input.credentialValue}`,
    `Account category: ${input.accountCategory}`,
    `Purpose: ${input.purpose}`,
    `${input.destinationLabel}: ${input.destination}`,
    `Expires at: ${input.expiresAt}`,
    ...(input.referenceId === undefined
      ? []
      : [`Challenge ID: ${input.referenceId}`]),
    "",
    input.instruction,
    input.securityNotice,
    "",
    "Cleanora will never ask you to share this credential by phone, chat, or social media.",
    "If you did not request this action, you can safely ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(input.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${colors.canvas};color:${colors.ink};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${colors.canvas};">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:${colors.white};border:1px solid ${colors.line};border-radius:18px;box-shadow:0 12px 36px rgba(7,76,67,.10);overflow:hidden;">
            <tr><td style="height:7px;background:${colors.yellow};font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:28px 38px;background:${colors.forest};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td>
                      <div style="color:${colors.white};font-size:25px;font-weight:800;letter-spacing:-.5px;">Cleanora</div>
                      <div style="margin-top:4px;color:#CDE8E1;font-size:12px;letter-spacing:1.3px;text-transform:uppercase;">A cleaner, healthier home</div>
                    </td>
                    <td align="right"><span style="display:inline-block;width:42px;height:42px;border-radius:50%;background:${colors.yellow};color:${colors.forest};font-size:20px;font-weight:900;line-height:42px;text-align:center;">C</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 38px 8px;">
                <div style="color:${colors.teal};font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</div>
                <h1 style="margin:8px 0 12px;color:${colors.forest};font-size:29px;line-height:36px;letter-spacing:-.5px;">${escapeHtml(input.heading)}</h1>
                <p style="margin:0;color:${colors.body};font-size:15px;line-height:24px;">${escapeHtml(input.introduction)}</p>
              </td>
            </tr>
            ${developmentBanner}
            <tr>
              <td style="padding:18px 38px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${colors.mint};border:1px solid #CBE5DC;border-radius:14px;">
                  <tr><td align="center" style="padding:22px 18px 8px;color:${colors.teal};font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(input.credentialLabel)}</td></tr>
                  <tr><td align="center" style="padding:0 18px 24px;color:${colors.forest};font-family:'Courier New',Courier,monospace;font-size:27px;font-weight:800;line-height:38px;letter-spacing:${letterSpacing};overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(input.credentialValue)}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 38px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">${rows}</table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 38px 18px;">
                <div style="padding:16px 18px;border-radius:12px;background:${colors.forest};color:${colors.white};font-size:14px;line-height:22px;"><strong style="color:${colors.yellow};">Next step:</strong> ${escapeHtml(input.instruction)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 38px 34px;">
                <div style="padding:14px 16px;border-left:4px solid ${colors.yellow};background:#FFF9E8;color:${colors.ink};font-size:13px;line-height:21px;"><strong>Security notice</strong><br>${escapeHtml(input.securityNotice)} Cleanora will never ask you to share this credential by phone, chat, or social media.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 38px;background:#E3F1EC;border-top:1px solid ${colors.line};color:${colors.body};font-size:12px;line-height:19px;text-align:center;">If you did not request this action, you can safely ignore this email.<br><strong style="color:${colors.forest};">Cleanora</strong> &middot; Trusted service providers for a cleaner, healthier home.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}
