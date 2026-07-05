import { defineTool } from "eve/tools";
import { z } from "zod";
import { callHostTool, summarizeHostToolResult } from "../lib/mcp_host";

export default defineTool({
  description: "List recent Agent runs from the Host-managed Toolbox MCP server.",
  inputSchema: z.object({
    limit: z.number().int().positive().max(100).optional()
  }),
  async execute(input) {
    return callHostTool("list-agent-runs", input);
  },
  toModelOutput: summarizeHostToolResult
});
