import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AgentContinuation } from "@agent-template/shared";

const continuationPrefix = "claude:v1:";

const ClaudeContinuationPayloadSchema = z.object({
  expiresAt: z.number().int().positive(),
  pendingToolUseId: z.string().min(1).optional(),
  sessionId: z.string().min(1),
});

export type ClaudeContinuationPayload = z.infer<
  typeof ClaudeContinuationPayloadSchema
>;

export function encodeClaudeContinuation(
  payload: Omit<ClaudeContinuationPayload, "expiresAt">,
  secret: string,
  ttlMs: number,
  now = Date.now(),
): AgentContinuation {
  const encodedPayload = Buffer.from(
    JSON.stringify({ ...payload, expiresAt: now + ttlMs }),
    "utf8",
  ).toString("base64url");
  const signature = sign(encodedPayload, secret);

  return { token: `${continuationPrefix}${encodedPayload}.${signature}` };
}

export function decodeClaudeContinuation(
  continuation: AgentContinuation | undefined,
  secret: string,
  now = Date.now(),
): ClaudeContinuationPayload | undefined {
  if (!continuation) {
    return undefined;
  }

  if (!continuation.token.startsWith(continuationPrefix)) {
    throw new Error("Invalid Claude continuation token");
  }

  const encoded = continuation.token.slice(continuationPrefix.length);
  const separator = encoded.lastIndexOf(".");
  if (separator <= 0 || separator === encoded.length - 1) {
    throw new Error("Invalid Claude continuation token");
  }

  const payload = encoded.slice(0, separator);
  const signature = encoded.slice(separator + 1);
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid Claude continuation signature");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid Claude continuation payload");
  }

  const parsed = ClaudeContinuationPayloadSchema.parse(decoded);
  if (parsed.expiresAt <= now) {
    throw new Error("Claude continuation token has expired");
  }

  return parsed;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
