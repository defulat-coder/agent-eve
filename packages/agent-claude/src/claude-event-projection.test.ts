import { describe, expect, it } from "vitest";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeEventProjection } from "./claude-event-projection.js";

describe("Claude event projection", () => {
  it("correlates tool results with their tool names", () => {
    const projection = new ClaudeEventProjection();

    expect(
      projection.project({
        message: {
          content: [
            {
              id: "tool-1",
              input: { limit: 3 },
              name: "mcp__toolbox__list-agent-runs",
              type: "tool_use",
            },
          ],
          role: "assistant",
        },
        parent_tool_use_id: null,
        session_id: "session-1",
        type: "assistant",
      } as unknown as SDKMessage),
    ).toEqual([
      {
        input: '{"fields":["limit"]}',
        kind: "tool-call",
        tool: "mcp__toolbox__list-agent-runs",
      },
    ]);

    expect(
      projection.project({
        message: {
          content: [
            {
              content: "ok",
              tool_use_id: "tool-1",
              type: "tool_result",
            },
          ],
          role: "user",
        },
        parent_tool_use_id: null,
        session_id: "session-1",
        type: "user",
      } as unknown as SDKMessage),
    ).toEqual([
      {
        kind: "tool-result",
        status: "completed",
        tool: "mcp__toolbox__list-agent-runs",
      },
    ]);
  });

  it("projects compaction, permission denials, subagents and usage", () => {
    const projection = new ClaudeEventProjection();
    const messages = [
      {
        compact_metadata: { pre_tokens: 90_000, trigger: "auto" },
        session_id: "session-1",
        subtype: "compact_boundary",
        type: "system",
      },
      {
        message: "Blocked",
        session_id: "session-1",
        subtype: "permission_denied",
        tool_name: "Bash",
        tool_use_id: "tool-2",
        type: "system",
      },
      {
        description: "分析订单",
        session_id: "session-1",
        subtype: "task_started",
        task_id: "task-1",
        type: "system",
      },
      {
        duration_api_ms: 10,
        duration_ms: 20,
        is_error: false,
        modelUsage: {},
        num_turns: 2,
        permission_denials: [],
        result: "Done",
        session_id: "session-1",
        stop_reason: "stop",
        subtype: "success",
        total_cost_usd: 0.12,
        type: "result",
        usage: {
          cache_creation_input_tokens: 2,
          cache_read_input_tokens: 3,
          input_tokens: 10,
          output_tokens: 5,
        },
      },
    ] as unknown as SDKMessage[];

    expect(messages.flatMap((message) => projection.project(message))).toEqual([
      { kind: "compaction", status: "completed", inputTokens: 90_000 },
      { kind: "tool-result", tool: "Bash", status: "rejected", error: "Blocked" },
      { kind: "subagent", name: "分析订单", status: "started" },
      {
        kind: "usage",
        inputTokens: 10,
        outputTokens: 5,
        cacheReadTokens: 3,
        cacheWriteTokens: 2,
        costUsd: 0.12,
      },
    ]);
  });
});
