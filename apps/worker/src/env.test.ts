import { describe, expect, it } from "vitest";
import { loadWorkerEnv } from "./env.js";

describe("loadWorkerEnv", () => {
  it("keeps Eve Agent runtime env config available after Worker env parsing", () => {
    expect(
      loadWorkerEnv({
        AGENT_RUNTIME: "eve",
        EVE_AGENT_MODEL: "eve-custom",
        REDIS_URL: "redis://localhost:16379"
      })
    ).toMatchObject({
      AGENT_RUNTIME: "eve",
      EVE_AGENT_MODEL: "eve-custom"
    });
  });
});
