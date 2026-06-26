import { loadWorkerEnv } from "./env.js";
import { createAgentWorkerRuntime, registerWorkerShutdown } from "./runtime.js";

const runtime = createAgentWorkerRuntime({ env: loadWorkerEnv() });
registerWorkerShutdown(runtime);
