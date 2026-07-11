import { describe, expect, it, vi } from "vitest";
import {
  defaultAnthropicBaseUrl,
  defaultClaudeAgentMaxTurns,
  defaultClaudeAgentModel,
  getClaudeAgentRuntimeStateFromEnv,
  runClaudeAgent,
} from "./index.js";
import { resolveClaudeAgentRoot } from "./authored-surface.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

describe("Claude Agent runtime", () => {
  it("does not require an Anthropic API key", () => {
    const state = getClaudeAgentRuntimeStateFromEnv({});

    expect(state.configured).toBe(false);
    expect(state.model).toBe(defaultClaudeAgentModel);
  });

  it("supports Kimi through the Anthropic-compatible protocol env", async () => {
    const calls: unknown[] = [];

    await expect(
      runClaudeAgent(
        { prompt: "Summarize this template" },
        {
          authToken: "test-token",
          baseUrl: defaultAnthropicBaseUrl,
          model: "kimi-for-coding",
        },
        {
          loadSdk: async () => ({
            query(params) {
              calls.push(params);

              return (async function* () {
                yield {
                  duration_api_ms: 0,
                  duration_ms: 0,
                  is_error: false,
                  modelUsage: {},
                  num_turns: 1,
                  permission_denials: [],
                  result: "Done",
                  session_id: "claude-session-1",
                  stop_reason: "stop",
                  subtype: "success",
                  total_cost_usd: 0,
                  type: "result",
                  usage: {},
                } as unknown as SDKMessage;
              })();
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      events: [
        { kind: "usage", costUsd: 0 },
        { kind: "done", result: "Done" },
      ],
      output: "Done",
      status: "completed",
    });

    expect(calls).toMatchObject([
      {
        options: {
          env: {
            ANTHROPIC_AUTH_TOKEN: "test-token",
            ANTHROPIC_BASE_URL: defaultAnthropicBaseUrl,
            CLAUDE_CODE_AUTO_COMPACT_WINDOW: "262144",
            CLAUDE_CONFIG_DIR: expect.any(String),
            CLAUDE_TOOLBOX_MCP_URL: "http://localhost:15000/mcp",
          },
          cwd: resolveClaudeAgentRoot(undefined),
          includePartialMessages: true,
          maxBudgetUsd: 5,
          maxTurns: defaultClaudeAgentMaxTurns,
          permissionMode: "dontAsk",
          persistSession: true,
          settingSources: ["project"],
          skills: "all",
          systemPrompt: { type: "preset", preset: "claude_code" },
          tools: ["AskUserQuestion"],
        },
      },
    ]);

    const subprocessEnv = (
      calls[0] as { options: { env: Record<string, string | undefined> } }
    ).options.env;
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_DEFAULT_HAIKU_MODEL");
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_DEFAULT_OPUS_MODEL");
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_DEFAULT_SONNET_MODEL");
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_MODEL");
  });

  it("forwards Claude partial text events while the model streams", async () => {
    const events: unknown[] = [];

    await expect(
      runClaudeAgent(
        { prompt: "Stream a short reply" },
        {
          authToken: "test-token",
          baseUrl: defaultAnthropicBaseUrl,
          model: "kimi-for-coding",
        },
        {
          loadSdk: async () => ({
            query() {
              return (async function* () {
                yield {
                  event: {
                    content_block: { citations: null, text: "", type: "text" },
                    index: 0,
                    type: "content_block_start",
                  },
                  parent_tool_use_id: null,
                  session_id: "claude-session-1",
                  type: "stream_event",
                  uuid: "partial-1",
                } as unknown as SDKMessage;
                yield {
                  event: {
                    delta: { text: "Hel", type: "text_delta" },
                    index: 0,
                    type: "content_block_delta",
                  },
                  parent_tool_use_id: null,
                  session_id: "claude-session-1",
                  type: "stream_event",
                  uuid: "partial-2",
                } as unknown as SDKMessage;
                yield {
                  event: {
                    delta: { text: "lo", type: "text_delta" },
                    index: 0,
                    type: "content_block_delta",
                  },
                  parent_tool_use_id: null,
                  session_id: "claude-session-1",
                  type: "stream_event",
                  uuid: "partial-3",
                } as unknown as SDKMessage;
                yield {
                  duration_api_ms: 0,
                  duration_ms: 0,
                  is_error: false,
                  modelUsage: {},
                  num_turns: 1,
                  permission_denials: [],
                  result: "Hello",
                  session_id: "claude-session-1",
                  stop_reason: "stop",
                  subtype: "success",
                  total_cost_usd: 0,
                  type: "result",
                  usage: {},
                } as unknown as SDKMessage;
              })();
            },
          }),
          onEvent(event) {
            events.push(event);
          },
        },
      ),
    ).resolves.toMatchObject({
      events: [
        { kind: "text", text: "Hel" },
        { kind: "text", text: "Hello" },
        { kind: "usage", costUsd: 0 },
        { kind: "done", result: "Hello" },
      ],
      output: "Hello",
      status: "completed",
    });

    expect(events).toEqual([
      { kind: "text", text: "Hel" },
      { kind: "text", text: "Hello" },
      { kind: "usage", costUsd: 0 },
      { kind: "done", result: "Hello" },
    ]);
  });

  it("loads Toolbox from the Claude filesystem-authored surface", async () => {
    const calls: unknown[] = [];

    await expect(
      runClaudeAgent(
        { prompt: "List recent agent runs" },
        {
          authToken: "test-token",
          baseUrl: defaultAnthropicBaseUrl,
          model: "kimi-for-coding",
          toolboxUrl: "http://toolbox:15000",
        },
        {
          loadSdk: async () => ({
            query(params) {
              calls.push(params);

              return (async function* () {
                yield {
                  session_id: "claude-session-1",
                  subtype: "thinking_tokens",
                  type: "system",
                } as unknown as SDKMessage;
                yield {
                  message: {
                    content: [
                      {
                        id: "toolu-1",
                        input: { limit: 3 },
                        name: "mcp__toolbox__list-agent-runs",
                        type: "tool_use",
                      },
                    ],
                    role: "assistant",
                  },
                  parent_tool_use_id: null,
                  session_id: "claude-session-1",
                  type: "assistant",
                } as unknown as SDKMessage;
                yield {
                  duration_api_ms: 0,
                  duration_ms: 0,
                  is_error: false,
                  modelUsage: {},
                  num_turns: 1,
                  permission_denials: [],
                  result: "Found recent runs",
                  session_id: "claude-session-1",
                  stop_reason: "stop",
                  subtype: "success",
                  total_cost_usd: 0,
                  type: "result",
                  usage: {},
                } as unknown as SDKMessage;
              })();
            },
          }),
        },
      ),
    ).resolves.toMatchObject({
      events: [
        {
          input: '{"limit":3}',
          kind: "tool-call",
          tool: "mcp__toolbox__list-agent-runs",
        },
        { kind: "usage", costUsd: 0 },
        { kind: "done", result: "Found recent runs" },
      ],
      output: "Found recent runs",
      status: "completed",
    });

    expect(calls).toMatchObject([
      {
        options: {
          cwd: resolveClaudeAgentRoot(undefined),
          includePartialMessages: true,
          settingSources: ["project"],
          skills: "all",
          systemPrompt: { type: "preset", preset: "claude_code" },
        },
      },
    ]);
    const subprocessEnv = (
      calls[0] as { options: { env: Record<string, string | undefined> } }
    ).options.env;
    expect(subprocessEnv).not.toHaveProperty("TOOLBOX_URL");
    expect(subprocessEnv.CLAUDE_TOOLBOX_MCP_URL).toBe(
      "http://toolbox:15000/mcp",
    );
  });

  it("defers AskUserQuestion and resumes through an opaque continuation", async () => {
    const queryCalls: unknown[] = [];
    const firstRun = await runClaudeAgent(
      { prompt: "分析本月销售" },
      {
        authToken: "test-token",
        baseUrl: defaultAnthropicBaseUrl,
        model: "kimi-for-coding",
      },
      {
        loadSdk: async () => ({
          query(params) {
            queryCalls.push(params);
            return (async function* () {
              yield {
                duration_api_ms: 0,
                duration_ms: 0,
                is_error: false,
                modelUsage: {},
                num_turns: 1,
                permission_denials: [],
                result: "",
                session_id: "claude-session-1",
                stop_reason: "tool_deferred",
                subtype: "success",
                total_cost_usd: 0,
                type: "result",
                usage: {},
                deferred_tool_use: {
                  id: "tool-1",
                  name: "AskUserQuestion",
                  input: {
                    questions: [
                      {
                        question: "选择统计口径？",
                        options: [
                          { label: "GMV" },
                          { label: "净销售额" },
                        ],
                      },
                    ],
                  },
                },
              } as unknown as SDKMessage;
            })();
          },
        }),
      },
    );

    expect(firstRun).toMatchObject({
      status: "waiting",
      continuation: { token: expect.stringMatching(/^claude:v1:/) },
      events: [
        { kind: "usage", costUsd: 0 },
        {
          kind: "input-requested",
          requests: [
            {
              requestId: "tool-1:0",
              prompt: "选择统计口径？",
            },
          ],
        },
        { kind: "waiting" },
      ],
    });

    if (firstRun.status !== "waiting" || !firstRun.continuation) {
      throw new Error("Expected a deferred Claude continuation");
    }

    const secondRun = await runClaudeAgent(
      {
        continuation: firstRun.continuation,
        responses: [{ requestId: "tool-1:0", optionId: "1" }],
      },
      {
        authToken: "test-token",
        baseUrl: defaultAnthropicBaseUrl,
        model: "kimi-for-coding",
      },
      {
        loadSdk: async () => ({
          query(params) {
            queryCalls.push(params);
            return (async function* () {
              yield {
                duration_api_ms: 0,
                duration_ms: 0,
                is_error: false,
                modelUsage: {},
                num_turns: 2,
                permission_denials: [],
                result: "净销售额为 100 元",
                session_id: "claude-session-1",
                stop_reason: "stop",
                subtype: "success",
                total_cost_usd: 0,
                type: "result",
                usage: {},
              } as unknown as SDKMessage;
            })();
          },
        }),
      },
    );

    expect(secondRun).toMatchObject({
      status: "completed",
      output: "净销售额为 100 元",
      continuation: { token: expect.stringMatching(/^claude:v1:/) },
    });
    expect(queryCalls[1]).toMatchObject({
      prompt: "",
      options: { resume: "claude-session-1", persistSession: true },
    });
  });

  it("fails closed when a continuation signature is invalid", async () => {
    const loadSdk = vi.fn();
    await expect(
      runClaudeAgent(
        { prompt: "继续", continuation: { token: "claude:v1:bad.bad" } },
        { authToken: "test-token", model: "kimi-for-coding" },
        { loadSdk },
      ),
    ).resolves.toMatchObject({
      status: "failed",
      reason: expect.stringContaining("signature"),
    });
    expect(loadSdk).not.toHaveBeenCalled();
  });
});
