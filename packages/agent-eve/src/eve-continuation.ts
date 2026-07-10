import { z } from "zod";
import type { SessionState } from "eve/client";
import type { AgentContinuation } from "@agent-template/shared";

const continuationPrefix = "eve:v1:";
const EveSessionStateSchema = z.object({
  continuationToken: z.string().min(1),
  sessionId: z.string().min(1),
  streamIndex: z.number().int().nonnegative(),
});

export function encodeEveContinuation(
  state: SessionState,
): AgentContinuation | undefined {
  const parsed = EveSessionStateSchema.safeParse(state);
  if (!parsed.success) {
    return undefined;
  }

  return {
    token: `${continuationPrefix}${Buffer.from(
      JSON.stringify(parsed.data),
      "utf8",
    ).toString("base64url")}`,
  };
}

export function decodeEveContinuation(
  continuation: AgentContinuation | undefined,
): SessionState | undefined {
  if (!continuation) {
    return undefined;
  }

  if (!continuation.token.startsWith(continuationPrefix)) {
    throw new Error("Invalid Eve Agent continuation");
  }

  try {
    const payload = continuation.token.slice(continuationPrefix.length);
    return EveSessionStateSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
    );
  } catch {
    throw new Error("Invalid Eve Agent continuation");
  }
}
