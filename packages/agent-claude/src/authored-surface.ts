import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const authoredSurfaceFiles = [
  "CLAUDE.md",
  ".claude/settings.json",
  ".mcp.json",
] as const;

export function resolveClaudeAgentRoot(
  configuredRoot: string | undefined,
  startDirectory = process.cwd(),
) {
  if (configuredRoot) {
    return assertAuthoredSurface(resolve(configuredRoot));
  }

  let currentDirectory = resolve(startDirectory);

  while (true) {
    const candidate = join(
      currentDirectory,
      "packages",
      "agent-claude",
      "agent",
    );

    if (isAuthoredSurface(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  throw new Error(
    "Claude authored surface was not found; set CLAUDE_AGENT_ROOT to packages/agent-claude/agent",
  );
}

function assertAuthoredSurface(root: string) {
  if (!isAuthoredSurface(root)) {
    throw new Error(`Invalid CLAUDE_AGENT_ROOT: ${root}`);
  }
  return root;
}

function isAuthoredSurface(root: string) {
  return authoredSurfaceFiles.every((file) => existsSync(join(root, file)));
}
