import { describe, expect, it } from "vitest";
import {
  defaultAnthropicBaseUrl,
  defaultClaudeAgentModel,
  getClaudeAgentRuntimeStateFromEnv,
  runClaudeAgentJob
} from "./index.js";
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
      runClaudeAgentJob(
        { prompt: "Summarize this template" },
        {
          authToken: "test-token",
          baseUrl: defaultAnthropicBaseUrl,
          model: "kimi-for-coding"
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
                  usage: {}
                } as unknown as SDKMessage;
              })();
            }
          })
        }
      )
    ).resolves.toMatchObject({
      events: [{ kind: "done", result: "Done" }],
      output: "Done",
      status: "completed"
    });

    expect(calls).toMatchObject([
      {
        options: {
          env: {
            ANTHROPIC_AUTH_TOKEN: "test-token",
            ANTHROPIC_BASE_URL: defaultAnthropicBaseUrl,
            CLAUDE_CODE_AUTO_COMPACT_WINDOW: "262144",
            CLAUDE_CONFIG_DIR: expect.any(String)
          },
          maxTurns: 1,
          permissionMode: "dontAsk",
          persistSession: false,
          tools: []
        }
      }
    ]);

    const subprocessEnv = (calls[0] as { options: { env: Record<string, string | undefined> } }).options.env;
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_DEFAULT_HAIKU_MODEL");
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_DEFAULT_OPUS_MODEL");
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_DEFAULT_SONNET_MODEL");
    expect(subprocessEnv).not.toHaveProperty("ANTHROPIC_MODEL");
  });
});
