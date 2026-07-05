import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

export const defaultMcpToolboxServerId = "toolbox";
export const defaultMcpToolboxToolset = "agent_template_read_model";
export const defaultMcpHostConfigFileName = "mcp-host.config.json";

export const McpHostConfigSchema = z.object({
  toolboxUrl: z.string().url().optional(),
  toolboxToolset: z.string().min(1).default(defaultMcpToolboxToolset)
});

export type McpHostConfig = z.infer<typeof McpHostConfigSchema>;

export type McpHostServer = {
  id: string;
  url: string;
  toolset: string;
};

export type McpHostTool = {
  name: string;
  description?: string | undefined;
  inputSchema: Record<string, unknown>;
};

export type McpHostToolCallResult = {
  content: unknown[];
  structuredContent?: Record<string, unknown> | undefined;
  isError?: boolean | undefined;
};

export type AgentRunsDashboardData = {
  runs: AgentRunSummary[];
  metrics: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    failureRate: number;
  };
};

export type AgentRunSummary = {
  runId: string;
  eventCount: number;
  terminalEvent: string | null;
  firstEventAt: string;
  lastEventAt: string;
};

type McpClientLike = {
  listTools(): Promise<{ tools: Array<{ name: string; description?: string | undefined; inputSchema: Record<string, unknown> }> }>;
  callTool(input: { name: string; arguments?: Record<string, unknown> }): Promise<McpHostToolCallResult>;
  close?(): Promise<void>;
};

type McpHostOptions = {
  createClient?: (server: McpHostServer) => Promise<McpClientLike>;
};

export function parseMcpHostConfig(input: Record<string, unknown>): McpHostConfig {
  return McpHostConfigSchema.parse({
    toolboxUrl: typeof input.toolboxUrl === "string" && input.toolboxUrl.length > 0 ? input.toolboxUrl : input.TOOLBOX_URL,
    toolboxToolset:
      typeof input.toolboxToolset === "string" && input.toolboxToolset.length > 0 ? input.toolboxToolset : input.TOOLBOX_TOOLSET
  });
}

export function loadMcpHostConfig(input: Record<string, unknown> = process.env): McpHostConfig {
  const fileConfig = readMcpHostConfigFile(input);

  return parseMcpHostConfig({
    ...input,
    ...fileConfig
  });
}

export function createMcpHost(config: McpHostConfig, options: McpHostOptions = {}) {
  const createClient = options.createClient ?? createMcpClient;

  function getServers(): McpHostServer[] {
    return config.toolboxUrl
      ? [
          {
            id: defaultMcpToolboxServerId,
            toolset: config.toolboxToolset,
            url: `${config.toolboxUrl.replace(/\/$/, "")}/mcp`
          }
        ]
      : [];
  }

  async function listTools(serverId = defaultMcpToolboxServerId): Promise<McpHostTool[]> {
    return withClient(serverId, async (client) => {
      const result = await client.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        ...(tool.description ? { description: tool.description } : {}),
        inputSchema: tool.inputSchema
      }));
    });
  }

  async function callTool(serverId: string, name: string, args: Record<string, unknown> = {}): Promise<McpHostToolCallResult> {
    return withClient(serverId, (client) => client.callTool({ name, arguments: args }));
  }

  async function createAgentRunsDashboard(limit = 20): Promise<AgentRunsDashboardData> {
    const result = await callTool(defaultMcpToolboxServerId, "list-agent-runs", { limit });
    const runs = readAgentRunRows(result);
    const completedRuns = runs.filter((run) => run.terminalEvent === "agent.run.completed").length;
    const failedRuns = runs.filter((run) => run.terminalEvent === "agent.run.failed").length;

    return {
      runs,
      metrics: {
        totalRuns: runs.length,
        completedRuns,
        failedRuns,
        failureRate: runs.length === 0 ? 0 : failedRuns / runs.length
      }
    };
  }

  async function withClient<T>(serverId: string, task: (client: McpClientLike) => Promise<T>): Promise<T> {
    const server = getServers().find((candidate) => candidate.id === serverId);
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }

    const client = await createClient(server);

    try {
      return await task(client);
    } finally {
      await client.close?.();
    }
  }

  return {
    getServers,
    listTools,
    callTool,
    createAgentRunsDashboard
  };
}

function readMcpHostConfigFile(input: Record<string, unknown>) {
  const configPath = findMcpHostConfigPath(process.env.INIT_CWD ?? process.cwd());
  if (!configPath) {
    return {};
  }

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${defaultMcpHostConfigFileName} must contain a JSON object`);
  }

  return {
    toolboxToolset: typeof parsed.toolboxToolset === "string" ? expandEnv(parsed.toolboxToolset, input) : undefined,
    toolboxUrl: typeof parsed.toolboxUrl === "string" ? expandEnv(parsed.toolboxUrl, input) : undefined
  };
}

function findMcpHostConfigPath(start: string) {
  let dir = start;

  while (true) {
    const candidate = join(dir, defaultMcpHostConfigFileName);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
}

function expandEnv(value: string, input: Record<string, unknown>) {
  return value.replace(/\$\{([A-Z0-9_]+)(?::-(.*?))?\}/g, (_match, name: string, fallback = "") => {
    const envValue = input[name];
    return typeof envValue === "string" && envValue.length > 0 ? envValue : fallback;
  });
}

export type McpHost = ReturnType<typeof createMcpHost>;

async function createMcpClient(server: McpHostServer): Promise<McpClientLike> {
  const client = new Client({ name: "agent-template-mcp-host", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(server.url));

  await client.connect(transport as Parameters<Client["connect"]>[0]);

  return {
    listTools: () => client.listTools(),
    callTool: async (input) => normalizeMcpToolCallResult(await client.callTool(input)),
    close: () => transport.close()
  };
}

function normalizeMcpToolCallResult(result: unknown): McpHostToolCallResult {
  if (isRecord(result) && Array.isArray(result.content)) {
    return {
      content: result.content,
      ...(isRecord(result.structuredContent) ? { structuredContent: result.structuredContent } : {}),
      ...(typeof result.isError === "boolean" ? { isError: result.isError } : {})
    };
  }

  return {
    content: [
      {
        text: JSON.stringify(result),
        type: "text"
      }
    ]
  };
}

function readAgentRunRows(result: McpHostToolCallResult): AgentRunSummary[] {
  const rows = Array.isArray(result.structuredContent?.result) ? result.structuredContent.result : readJsonTextContent(result.content);

  return rows.flatMap((row) => {
    if (!isRecord(row)) {
      return [];
    }

    const runId = String(row.runId ?? "");
    const eventCount = Number(row.eventCount ?? 0);
    const firstEventAt = String(row.firstEventAt ?? "");
    const lastEventAt = String(row.lastEventAt ?? "");
    const terminalEvent = row.terminalEvent === null || row.terminalEvent === undefined ? null : String(row.terminalEvent);

    return runId ? [{ runId, eventCount, firstEventAt, lastEventAt, terminalEvent }] : [];
  });
}

function readJsonTextContent(content: unknown[]) {
  const rows: unknown[] = [];

  for (const part of content) {
    if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string") {
      continue;
    }

    try {
      const parsed = JSON.parse(part.text) as unknown;
      if (Array.isArray(parsed)) {
        rows.push(...parsed);
      } else if (isRecord(parsed)) {
        rows.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
