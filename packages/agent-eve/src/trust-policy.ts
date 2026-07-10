import { createHash, timingSafeEqual } from "node:crypto";
import { localDev, type AuthFn, vercelOidc } from "eve/channels/auth";

export function createEveChannelAuth(
  env: Record<string, string | undefined> = process.env,
): AuthFn<Request>[] {
  const auth: AuthFn<Request>[] = [
    serviceTokenAuth(env.EVE_AGENT_SERVICE_TOKEN),
    vercelOidc(),
  ];

  if (env.NODE_ENV !== "production") {
    auth.push(localDev());
  }

  return auth;
}

export function serviceTokenAuth(
  expected: string | undefined,
): AuthFn<Request> {
  return (request) => {
    if (!expected) {
      return null;
    }

    return matchesServiceToken(
      request.headers.get("x-agent-template-eve-token"),
      expected,
    )
      ? servicePrincipal()
      : null;
  };
}

export function isLoopbackEveHost(host: string) {
  const hostname = new URL(host).hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

export function matchesServiceToken(
  actual: string | null,
  expected: string,
): boolean {
  if (!actual || !expected) {
    return false;
  }

  return timingSafeEqual(hashToken(actual), hashToken(expected));
}

function servicePrincipal() {
  return {
    attributes: {},
    authenticator: "agent-template-api",
    principalId: "agent-template-api",
    principalType: "service" as const,
  };
}

function hashToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}
