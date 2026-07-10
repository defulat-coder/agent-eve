import { describe, expect, it } from "vitest";
import { AgentRunResultSchema } from "./agent-run";

describe("AgentRunResultSchema", () => {
  it("accepts completed Agent runs with run events", () => {
    expect(
      AgentRunResultSchema.parse({
        configured: true,
        events: [{ kind: "done", result: "Done" }],
        model: "kimi-for-coding",
        output: "Done",
        promptLength: 9,
        runtime: "claude",
        status: "completed",
      }),
    ).toEqual({
      configured: true,
      events: [{ kind: "done", result: "Done" }],
      model: "kimi-for-coding",
      output: "Done",
      promptLength: 9,
      runtime: "claude",
      status: "completed",
    });
  });

  it("accepts a waiting Eve run with a durable session cursor", () => {
    expect(
      AgentRunResultSchema.parse({
        configured: true,
        events: [{ kind: "waiting" }],
        model: "kimi-for-coding",
        output: "请确认是否继续。",
        promptLength: 9,
        runtime: "eve",
        sessionId: "session-1",
        continuation: { token: "opaque-token" },
        status: "waiting",
      }),
    ).toMatchObject({
      runtime: "eve",
      status: "waiting",
      continuation: { token: "opaque-token" },
    });
  });

  it("accepts structured HITL responses with an opaque continuation", async () => {
    const { AgentRunInputSchema } = await import("./agent-run");

    expect(
      AgentRunInputSchema.parse({
        continuation: { token: "opaque-token" },
        responses: [{ requestId: "request-1", optionId: "approve" }],
      }),
    ).toEqual({
      continuation: { token: "opaque-token" },
      responses: [{ requestId: "request-1", optionId: "approve" }],
    });
    expect(() =>
      AgentRunInputSchema.parse({
        responses: [{ requestId: "request-1", text: "yes" }],
      }),
    ).toThrow("require a continuation");
  });
});
