export interface R1P06Cursor {
  readonly at: Date;
  readonly id: string;
}

export function encodeR1P06Cursor(scope: string, at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ v: 1, scope, at: at.toISOString(), id }), "utf8").toString("base64url");
}

export function decodeR1P06Cursor(raw: string | undefined, scope: string): R1P06Cursor | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
    if (parsed["v"] !== 1 || parsed["scope"] !== scope || typeof parsed["at"] !== "string" || typeof parsed["id"] !== "string" || parsed["id"].length === 0) throw new Error("invalid");
    const at = new Date(parsed["at"]);
    if (Number.isNaN(at.getTime()) || at.toISOString() !== parsed["at"]) throw new Error("invalid");
    return { at, id: parsed["id"] };
  } catch {
    throw new Error("VALIDATION_ERROR");
  }
}
