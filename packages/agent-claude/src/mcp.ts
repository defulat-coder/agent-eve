import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export const claudeToolboxServerName = "toolbox";

export const claudeToolboxToolNames = [
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

export function createClaudeMcpServers(
  toolboxUrl: string | undefined,
): Record<string, McpServerConfig> {
  if (!toolboxUrl) {
    return {};
  }

  return {
    [claudeToolboxServerName]: {
      type: "http",
      url: toMcpEndpoint(toolboxUrl),
      tools: claudeToolboxToolNames.map((name) => ({
        name,
        permission_policy: "always_allow",
      })),
    },
  };
}

export function readClaudeMcpAllowedTools(toolboxUrl: string | undefined) {
  return toolboxUrl
    ? claudeToolboxToolNames.map(
        (name) => `mcp__${claudeToolboxServerName}__${name}`,
      )
    : [];
}

function toMcpEndpoint(toolboxUrl: string) {
  const normalized = toolboxUrl.replace(/\/+$/, "");
  return normalized.endsWith("/mcp") ? normalized : `${normalized}/mcp`;
}
