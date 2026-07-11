export function summarizeClaudeToolInput(
  tool: string,
  input: unknown,
): string {
  if (tool === "AskUserQuestion") {
    const questions = readArrayProperty(input, "questions");
    return JSON.stringify({ questions: questions?.length ?? 0 });
  }

  if (tool.startsWith("mcp__toolbox__")) {
    return JSON.stringify({ fields: readRecordKeys(input) });
  }

  return "[redacted]";
}

function readRecordKeys(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }
  return Object.keys(input).sort();
}

function readArrayProperty(input: unknown, key: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : undefined;
}
