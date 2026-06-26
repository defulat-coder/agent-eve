import { describe, expect, it } from "vitest";
import { createLogger } from "./index.js";

describe("createLogger", () => {
  it("creates a named pino logger", () => {
    const logger = createLogger({ service: "test-service", enabled: false });

    expect(logger.bindings().name).toBe("test-service");
  });
});
