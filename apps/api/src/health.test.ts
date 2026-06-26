import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

describe("GET /health", () => {
  it("returns health status without external services in tests", async () => {
    const app = buildApp({
      env: loadEnv({ NODE_ENV: "test" }),
      checkExternal: false
    });

    const response = await app.inject({ method: "GET", url: "/health" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.service).toBe("api");
    expect(body.status).toBe("ok");
    expect(body.database.status).toBe("skipped");
    expect(body.redis.status).toBe("skipped");
    expect(body.claude.configured).toBe(false);
  });
});
