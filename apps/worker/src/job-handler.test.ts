import { describe, expect, it } from "vitest";
import { handleAgentJob } from "./job-handler.js";

describe("handleAgentJob", () => {
  it("handles a valid agent job without requiring Claude credentials", async () => {
    const result = await handleAgentJob(
      {
        prompt: "Summarize this template",
        requestedAt: new Date("2026-06-26T00:00:00.000Z").toISOString()
      },
      {}
    );

    expect(result.accepted).toBe(true);
    expect(result.promptLength).toBe(23);
    expect(result.runtime).toBe("claude");
    expect(result.configured).toBe(false);
  });

  it("uses the Eve Agent runtime selected by env", async () => {
    const result = await handleAgentJob(
      {
        prompt: "Summarize this template",
        requestedAt: new Date("2026-06-26T00:00:00.000Z").toISOString()
      },
      { AGENT_RUNTIME: "eve" }
    );

    expect(result.runtime).toBe("eve");
    expect(result.configured).toBe(true);
  });

  it("rejects invalid queued payloads at the Worker seam", async () => {
    await expect(handleAgentJob({ prompt: "", requestedAt: "not-a-date" }, {})).rejects.toThrow();
  });
});
