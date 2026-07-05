import { describe, expect, it } from "vitest";
import { createMcpHost, parseMcpHostConfig } from "./index.js";

describe("MCP Host", () => {
  it("registers the Toolbox MCP server from static env config", () => {
    const host = createMcpHost(
      parseMcpHostConfig({
        TOOLBOX_URL: "http://toolbox:15000",
        TOOLBOX_TOOLSET: "agent_template_read_model"
      })
    );

    expect(host.getServers()).toEqual([
      {
        id: "toolbox",
        toolset: "agent_template_read_model",
        url: "http://toolbox:15000/mcp"
      }
    ]);
  });

  it("lists tools through a Host-managed MCP client", async () => {
    const host = createMcpHost(parseMcpHostConfig({ TOOLBOX_URL: "http://toolbox:15000" }), {
      createClient: async () => ({
        async listTools() {
          return {
            tools: [
              {
                description: "List recent Agent runs",
                inputSchema: { type: "object" },
                name: "list-agent-runs"
              }
            ]
          };
        },
        async callTool() {
          throw new Error("not used");
        }
      })
    });

    await expect(host.listTools()).resolves.toEqual([
      {
        description: "List recent Agent runs",
        inputSchema: { type: "object" },
        name: "list-agent-runs"
      }
    ]);
  });

  it("builds Agent run dashboard data from a Host-managed Toolbox call", async () => {
    const host = createMcpHost(parseMcpHostConfig({ TOOLBOX_URL: "http://toolbox:15000" }), {
      createClient: async () => ({
        async listTools() {
          return { tools: [] };
        },
        async callTool(input) {
          expect(input).toEqual({ name: "list-agent-runs", arguments: { limit: 3 } });

          return {
            content: [],
            structuredContent: {
              result: [
                {
                  eventCount: 4,
                  firstEventAt: "2026-07-04T11:30:00.000Z",
                  lastEventAt: "2026-07-04T11:30:22.000Z",
                  runId: "run_knowledge_001",
                  terminalEvent: "agent.run.completed"
                },
                {
                  eventCount: 3,
                  firstEventAt: "2026-07-04T10:15:00.000Z",
                  lastEventAt: "2026-07-04T10:15:11.000Z",
                  runId: "run_invoice_001",
                  terminalEvent: "agent.run.failed"
                }
              ]
            }
          };
        }
      })
    });

    await expect(host.createAgentRunsDashboard(3)).resolves.toEqual({
      metrics: {
        completedRuns: 1,
        failedRuns: 1,
        failureRate: 0.5,
        totalRuns: 2
      },
      runs: [
        {
          eventCount: 4,
          firstEventAt: "2026-07-04T11:30:00.000Z",
          lastEventAt: "2026-07-04T11:30:22.000Z",
          runId: "run_knowledge_001",
          terminalEvent: "agent.run.completed"
        },
        {
          eventCount: 3,
          firstEventAt: "2026-07-04T10:15:00.000Z",
          lastEventAt: "2026-07-04T10:15:11.000Z",
          runId: "run_invoice_001",
          terminalEvent: "agent.run.failed"
        }
      ]
    });
  });

  it("builds Agent run dashboard data from Toolbox text rows", async () => {
    const host = createMcpHost(parseMcpHostConfig({ TOOLBOX_URL: "http://toolbox:15000" }), {
      createClient: async () => ({
        async listTools() {
          return { tools: [] };
        },
        async callTool() {
          return {
            content: [
              {
                text: JSON.stringify({
                  eventCount: 4,
                  firstEventAt: "2026-07-04T11:30:00Z",
                  lastEventAt: "2026-07-04T11:30:22Z",
                  runId: "run_knowledge_001",
                  terminalEvent: "agent.run.completed"
                }),
                type: "text"
              },
              {
                text: JSON.stringify({
                  eventCount: 3,
                  firstEventAt: "2026-07-04T10:15:00Z",
                  lastEventAt: "2026-07-04T10:15:11Z",
                  runId: "run_invoice_001",
                  terminalEvent: "agent.run.failed"
                }),
                type: "text"
              }
            ]
          };
        }
      })
    });

    await expect(host.createAgentRunsDashboard()).resolves.toMatchObject({
      metrics: {
        completedRuns: 1,
        failedRuns: 1,
        totalRuns: 2
      },
      runs: [
        { runId: "run_knowledge_001" },
        { runId: "run_invoice_001" }
      ]
    });
  });
});
