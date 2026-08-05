import { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createRuntimeDependencies } from "../../../src/composition.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";

describe("runtime composition", () => {
  it("constructs the concrete runtime without connecting or mounting", () => {
    const environment = createTestEnvironment();
    const connect = vi.spyOn(PrismaLifecycle.prototype, "connect");

    const runtime = createRuntimeDependencies(environment);

    expect(connect).not.toHaveBeenCalled();
    expect(runtime.database).toBeInstanceOf(PrismaLifecycle);
    expect(runtime.routes.environment).toBe(environment);
    expect(runtime.routes.logger).toBe(runtime.logger);
    expect(runtime.routes.readinessProbes).toHaveLength(1);
    expect(runtime.routes.authenticationRouter).toBeUndefined();
  });
});
