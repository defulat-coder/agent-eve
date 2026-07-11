import { describe, expect, it } from "vitest";
import {
  ClaudeSessionContinuations,
  createInMemoryClaudeContinuationStore,
} from "./claude-session-continuations.js";

const secret = "test-secret-with-at-least-thirty-two-characters";

describe("Claude session continuations", () => {
  it("leases once, consumes the token and rotates to a new token", async () => {
    const continuations = new ClaudeSessionContinuations({
      leaseMs: 1_000,
      secret,
      store: createInMemoryClaudeContinuationStore(),
      ttlMs: 60_000,
    });
    const token = continuations.issue({ sessionId: "session-1" });
    const lease = await continuations.acquire(token);

    expect(lease.payload.sessionId).toBe("session-1");
    await lease.complete();
    await expect(continuations.acquire(token)).rejects.toThrow("consumed");
    expect(continuations.issue({ sessionId: "session-1" })).not.toEqual(token);
  });

  it("rejects concurrent acquisition and permits retry after release", async () => {
    const continuations = new ClaudeSessionContinuations({
      leaseMs: 1_000,
      secret,
      store: createInMemoryClaudeContinuationStore(),
      ttlMs: 60_000,
    });
    const token = continuations.issue({ sessionId: "session-1" });
    const lease = await continuations.acquire(token);

    await expect(continuations.acquire(token)).rejects.toThrow("in use");
    await lease.release();
    await expect(continuations.acquire(token)).resolves.toMatchObject({
      payload: { sessionId: "session-1" },
    });
  });
});
