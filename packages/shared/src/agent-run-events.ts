import { z } from "zod";

export const AgentArtifactSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
  content: z.string()
});

export const AgentRunsDashboardDataSchema = z.object({
  metrics: z.object({
    totalRuns: z.number(),
    completedRuns: z.number(),
    failedRuns: z.number(),
    failureRate: z.number()
  }),
  runs: z.array(
    z.object({
      runId: z.string(),
      eventCount: z.number(),
      terminalEvent: z.string().nullable(),
      firstEventAt: z.string(),
      lastEventAt: z.string()
    })
  )
});

export const AgentMcpAppUiSchema = z.object({
  component: z.literal("mcp-app"),
  id: z.string(),
  resource: z.object({
    mimeType: z.literal("text/html;profile=mcp-app"),
    uri: z.string().startsWith("ui://")
  }),
  serverId: z.string(),
  title: z.string(),
  toolData: z.record(z.string(), z.unknown()),
  toolName: z.string()
});

export const AgentRunUiSchema = AgentMcpAppUiSchema;

export const AgentRunEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tool-call"), tool: z.string(), input: z.string() }),
  z.object({ kind: z.literal("tool-result"), tool: z.string() }),
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("ui"), ui: AgentRunUiSchema }),
  z.object({ kind: z.literal("done"), result: z.string() }),
  z.object({ kind: z.literal("error"), message: z.string() }),
  z.object({ kind: z.literal("artifacts"), tabs: z.array(AgentArtifactSchema) }),
  z.object({ kind: z.literal("unknown"), text: z.string() })
]);

export type AgentArtifact = z.infer<typeof AgentArtifactSchema>;
export type AgentRunsDashboardData = z.infer<typeof AgentRunsDashboardDataSchema>;
export type AgentMcpAppUi = z.infer<typeof AgentMcpAppUiSchema>;
export type AgentRunUi = z.infer<typeof AgentRunUiSchema>;
export type AgentRunEvent = z.infer<typeof AgentRunEventSchema>;
