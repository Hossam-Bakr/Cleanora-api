import { readFileSync } from "node:fs";
import { join } from "node:path";

const principalTypeSource = readFileSync(
  join(
    process.cwd(),
    "src/modules/authentication/domain/authentication.types.ts",
  ),
  "utf8",
);

/**
 * FR-020 / FR-028 freeze: R1-P03 consumes the authentication principal without
 * changing it. No role code, permission code, or authorization field is added.
 */
describe("AuthenticationPrincipal contract freeze", () => {
  const principalBlock =
    /export interface AuthenticationPrincipal \{([\s\S]*?)\n\}/u.exec(
      principalTypeSource,
    )?.[1];

  it("declares exactly the seven frozen members", () => {
    expect(principalBlock).toBeDefined();

    const memberNames = [
      ...(principalBlock ?? "").matchAll(/^\s*readonly (\w+):/gmu),
    ]
      .map((match) => match[1])
      .sort();

    expect(memberNames).toEqual([
      "accountCategories",
      "pendingCategories",
      "sessionId",
      "status",
      "userId",
      "verificationOnly",
      "verifiedCategories",
    ]);
  });

  it("carries no role or permission field", () => {
    expect(principalBlock).not.toMatch(/role/iu);
    expect(principalBlock).not.toMatch(/permission/iu);
    expect(principalBlock).not.toMatch(/grant/iu);
  });
});
