import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getClaudeAgentRuntimeStateFromEnv,
  parseClaudeAgentConfig,
  runClaudeAgent,
} from "../src/index.js";

const agentRoot = fileURLToPath(new URL("../agent", import.meta.url));
const live = process.env.CLAUDE_AGENT_LIVE_EVAL === "1";

describe("Claude production evals", () => {
  it("keeps the authored tool surface read-only and fail-closed", () => {
    const settings = JSON.parse(
      readFileSync(join(agentRoot, ".claude/settings.json"), "utf8"),
    ) as {
      disableSkillShellExecution: boolean;
      permissions: { allow: string[]; defaultMode: string; deny: string[] };
    };

    expect(settings.disableSkillShellExecution).toBe(true);
    expect(settings.permissions.defaultMode).toBe("dontAsk");
    expect(settings.permissions.allow).toContain("AskUserQuestion");
    expect(settings.permissions.allow).toContain(
      "mcp__toolbox__summarize-ecommerce-sales-by-day",
    );
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(["Agent", "Bash", "Read", "Write", "WebFetch"]),
    );
  });

  it.skipIf(!live)(
    "uses the sales Skill and Toolbox without invoking forbidden built-ins",
    async () => {
      const state = getClaudeAgentRuntimeStateFromEnv(process.env);
      expect(state.configured).toBe(true);

      const run = await runClaudeAgent(
        {
          prompt:
            "分析 2026-06-01 到 2026-06-30 的每日销售趋势，并说明 GMV、退款和净销售口径。",
        },
        parseClaudeAgentConfig(process.env),
      );

      expect(run.status).toBe("completed");
      if (run.status !== "completed") {
        throw new Error("Claude live eval did not complete");
      }
      expect(run.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "tool-call",
            tool: "mcp__toolbox__summarize-ecommerce-sales-by-day",
          }),
        ]),
      );
      expect(run.events).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "tool-call",
            tool: expect.stringMatching(/^(Bash|Read|Write|WebFetch)$/),
          }),
        ]),
      );
    },
    180_000,
  );
});
