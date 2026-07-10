import { describe, expect, it } from "vitest";
import type { HandleMessageStreamEvent } from "eve/client";
import {
  projectEveStreamEvent,
  projectEveTurn,
} from "./eve-turn-projection.js";

describe("Eve turn projection", () => {
  it("keeps waiting as a successful turn boundary and prefers structured output", () => {
    const events: HandleMessageStreamEvent[] = [
      {
        type: "message.completed",
        data: {
          finishReason: "stop",
          message: "fallback",
          sequence: 1,
          stepIndex: 0,
          turnId: "turn-1",
        },
      },
      {
        type: "result.completed",
        data: {
          result: { answer: 42 },
          sequence: 2,
          stepIndex: 0,
          turnId: "turn-1",
        },
      },
      { type: "session.waiting", data: { wait: "next-user-message" } },
    ];

    expect(projectEveTurn(events)).toEqual({
      status: "waiting",
      output: '{"answer":42}',
    });
  });

  it("gives a terminal session failure precedence over prior boundaries", () => {
    const events: HandleMessageStreamEvent[] = [
      { type: "session.waiting", data: { wait: "next-user-message" } },
      {
        type: "session.failed",
        data: {
          code: "SESSION_FAILED",
          message: "failed",
          sessionId: "session-1",
        },
      },
    ];

    expect(projectEveTurn(events)).toEqual({
      status: "failed",
      reason: "failed",
    });
  });

  it("projects typed HITL requests without leaking tool input", () => {
    const event: HandleMessageStreamEvent = {
      type: "input.requested",
      data: {
        requests: [
          {
            requestId: "request-1",
            prompt: "是否批准？",
            display: "confirmation",
            action: {
              callId: "call-1",
              input: { secret: "not-projected" },
              kind: "tool-call",
              toolName: "toolbox__list-agent-runs",
            },
            options: [
              { id: "approve", label: "批准", style: "primary" },
              { id: "deny", label: "拒绝", style: "danger" },
            ],
          },
        ],
        sequence: 1,
        stepIndex: 0,
        turnId: "turn-1",
      },
    };

    expect(projectEveStreamEvent(event)).toEqual([
      {
        kind: "input-requested",
        requests: [
          {
            requestId: "request-1",
            prompt: "是否批准？",
            tool: "toolbox__list-agent-runs",
            display: "confirmation",
            options: [
              { id: "approve", label: "批准", style: "primary" },
              { id: "deny", label: "拒绝", style: "danger" },
            ],
          },
        ],
      },
    ]);
  });
});
