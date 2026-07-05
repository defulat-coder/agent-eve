import { createMcpHost, parseMcpHostConfig } from "@agent-template/mcp-host";

export function callHostTool(toolName: string, args: Record<string, unknown>) {
  return createMcpHost(parseMcpHostConfig(process.env)).callTool("toolbox", toolName, args);
}

export function summarizeHostToolResult(result: unknown) {
  return {
    type: "json" as const,
    value: result
  };
}
