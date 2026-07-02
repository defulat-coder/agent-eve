import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/worker.ts"],
  format: ["esm"],
  external: ["@anthropic-ai/claude-agent-sdk", "bullmq", "ioredis", "pino", "zod"],
  noExternal: [/^@agent-template\//],
  clean: true
});
