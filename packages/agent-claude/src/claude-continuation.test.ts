import { describe, expect, it } from "vitest";
import {
  decodeClaudeContinuation,
  encodeClaudeContinuation,
} from "./claude-continuation.js";

const secret = "test-secret-with-at-least-thirty-two-characters";

describe("Claude continuation", () => {
  it("round trips a signed session without exposing it as the public shape", () => {
    const continuation = encodeClaudeContinuation(
      { sessionId: "session-1", pendingToolUseId: "tool-1" },
      secret,
      1_000,
      100,
    );

    expect(continuation).toEqual({ token: expect.stringMatching(/^claude:v1:/) });
    expect(decodeClaudeContinuation(continuation, secret, 200)).toEqual({
      expiresAt: 1_100,
      pendingToolUseId: "tool-1",
      sessionId: "session-1",
    });
  });

  it("rejects tampered and expired continuations", () => {
    const continuation = encodeClaudeContinuation(
      { sessionId: "session-1" },
      secret,
      100,
      100,
    );

    expect(() =>
      decodeClaudeContinuation(
        { token: `${continuation.token}tampered` },
        secret,
        150,
      ),
    ).toThrow("signature");
    expect(() => decodeClaudeContinuation(continuation, secret, 200)).toThrow(
      "expired",
    );
  });
});
