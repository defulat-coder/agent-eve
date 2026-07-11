import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveClaudeAgentRoot } from "./authored-surface.js";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const expectedAgentRoot = join(
  repositoryRoot,
  "packages",
  "agent-claude",
  "agent",
);

const expectedToolboxTools = [
  "get-agent-run-summary",
  "get-ecommerce-order-detail",
  "get-template-event",
  "list-agent-run-timeline",
  "list-agent-runs",
  "list-ecommerce-fulfillment-exceptions",
  "list-ecommerce-orders-in-window",
  "list-ecommerce-top-products",
  "list-failed-agent-runs-in-window",
  "list-template-events",
  "list-template-events-in-window",
  "summarize-ecommerce-sales-by-channel",
  "summarize-ecommerce-sales-by-day",
  "summarize-template-events-by-type",
  "summarize-tool-invocations",
] as const;

describe("Claude filesystem-authored surface", () => {
  it("uses the package-local Claude project root", () => {
    const agentRoot = resolveClaudeAgentRoot(undefined, repositoryRoot);

    expect(agentRoot).toBe(expectedAgentRoot);
    expect(existsSync(join(agentRoot, "CLAUDE.md"))).toBe(true);
    expect(existsSync(join(agentRoot, ".claude/settings.json"))).toBe(true);
    expect(existsSync(join(agentRoot, ".mcp.json"))).toBe(true);
  });

  it("survives API and Worker bundling by resolving from nested output", () => {
    expect(
      resolveClaudeAgentRoot(undefined, join(repositoryRoot, "apps/api/dist")),
    ).toBe(expectedAgentRoot);
    expect(
      resolveClaudeAgentRoot(
        undefined,
        join(repositoryRoot, "apps/worker/dist"),
      ),
    ).toBe(expectedAgentRoot);
  });

  it("accepts only an explicit authored surface override", () => {
    expect(resolveClaudeAgentRoot(expectedAgentRoot, "/tmp")).toBe(
      expectedAgentRoot,
    );
    expect(() => resolveClaudeAgentRoot("/tmp", repositoryRoot)).toThrow(
      "Invalid CLAUDE_AGENT_ROOT",
    );
  });

  it("owns the Toolbox connection and exact allowlist on disk", () => {
    const agentRoot = expectedAgentRoot;
    const mcpConfig = readJson(join(agentRoot, ".mcp.json"));
    const settings = readJson(join(agentRoot, ".claude/settings.json"));

    expect(mcpConfig).toEqual({
      mcpServers: {
        toolbox: {
          type: "http",
          url: "${CLAUDE_TOOLBOX_MCP_URL:-http://localhost:15000/mcp}",
        },
      },
    });
    expect(settings).toMatchObject({
      cleanupPeriodDays: 30,
      disableClaudeAiConnectors: true,
      disableSkillShellExecution: true,
      enableAllProjectMcpServers: false,
      enabledMcpjsonServers: ["toolbox"],
      permissions: {
        allow: [
          "AskUserQuestion",
          ...expectedToolboxTools.map((name) => `mcp__toolbox__${name}`),
        ],
        defaultMode: "dontAsk",
        deny: expect.arrayContaining([
          "Agent",
          "Bash",
          "Edit",
          "Read",
          "WebFetch",
          "WebSearch",
          "Write",
        ]),
      },
    });
  });

  it("keeps stable instructions in CLAUDE.md", () => {
    const instructions = readFileSync(
      join(expectedAgentRoot, "CLAUDE.md"),
      "utf8",
    );

    expect(instructions).toContain("用户可见回复默认使用中文");
    expect(instructions).toContain("只读 Tool");
    expect(instructions).toContain("加载最匹配的项目 Skill");
    expect(instructions).toContain("选项互斥");
  });
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
