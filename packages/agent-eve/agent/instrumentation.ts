import { defineInstrumentation } from "eve/instrumentation";

export default defineInstrumentation({
  functionId: "agent-template-eve",
  recordInputs: false,
  recordOutputs: false,
  events: {
    "step.started"({ channel, session }) {
      return {
        runtimeContext: {
          channel: channel.kind ?? "unknown",
          principalType:
            session.auth.current?.principalType ?? "unauthenticated",
          runtime: "eve",
        },
      };
    },
  },
});
