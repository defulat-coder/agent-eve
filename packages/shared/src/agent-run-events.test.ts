import { describe, expect, it } from "vitest";
import { AgentRunEventSchema } from "./agent-run-events";

describe("AgentRunEventSchema", () => {
  it("accepts the shared Agent run event protocol", () => {
    expect(
      AgentRunEventSchema.parse({
        kind: "tool-call",
        tool: "search",
        input: "{\"q\":\"agentcn\"}"
      })
    ).toEqual({
      kind: "tool-call",
      tool: "search",
      input: "{\"q\":\"agentcn\"}"
    });
    expect(AgentRunEventSchema.parse({ kind: "tool-result", tool: "search" })).toEqual({
      kind: "tool-result",
      tool: "search"
    });
    expect(AgentRunEventSchema.parse({ kind: "text", text: "hello" })).toEqual({ kind: "text", text: "hello" });
    expect(
      AgentRunEventSchema.parse({
        kind: "ui",
        ui: {
          component: "mcp-app",
          id: "agent-runs-mcp-app",
          resource: {
            mimeType: "text/html;profile=mcp-app",
            uri: "ui://agent-template/agent-runs"
          },
          serverId: "toolbox",
          title: "Agent Runs MCP App",
          toolData: { metrics: { totalRuns: 0 }, runs: [] },
          toolName: "list-agent-runs"
        }
      })
    ).toMatchObject({ kind: "ui", ui: { component: "mcp-app" } });
    expect(AgentRunEventSchema.parse({ kind: "done", result: "ok" })).toEqual({ kind: "done", result: "ok" });
  });

  it("accepts error, artifact, and unknown events", () => {
    const artifacts = AgentRunEventSchema.parse({
      kind: "artifacts",
      tabs: [{ id: "summary", label: "Summary", hint: "md", content: "# Done" }]
    });

    expect(AgentRunEventSchema.parse({ kind: "error", message: "failed" })).toEqual({ kind: "error", message: "failed" });
    expect(artifacts).toEqual({
      kind: "artifacts",
      tabs: [{ id: "summary", label: "Summary", hint: "md", content: "# Done" }]
    });
    expect(AgentRunEventSchema.parse({ kind: "unknown", text: "raw event" })).toEqual({ kind: "unknown", text: "raw event" });
  });
});
