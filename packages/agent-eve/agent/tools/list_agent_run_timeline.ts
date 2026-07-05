import { defineTool } from "eve/tools";
import { z } from "zod";
import { callHostTool, summarizeHostToolResult } from "../lib/mcp_host";

export default defineTool({
  description: "List the event timeline for one Agent run from the Host-managed Toolbox MCP server.",
  inputSchema: z.object({
    runId: z.string().min(1)
  }),
  async execute(input) {
    return callHostTool("list-agent-run-timeline", input);
  },
  toModelOutput: summarizeHostToolResult
});
