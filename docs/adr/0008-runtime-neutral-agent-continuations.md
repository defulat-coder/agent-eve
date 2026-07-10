# Runtime-neutral Agent continuations

Agent Template exposes multi-turn state as an opaque Agent continuation plus structured Agent input responses. Runtime adapters own the conversion to native state such as Eve `SessionState` and `InputResponse`; shared schemas, API, and Web do not expose `continuationToken`, `streamIndex`, or other runtime-specific cursor fields. This keeps the Agent runtime seam from ADR 0001 stable while still allowing Eve durable sessions and HITL to work end to end.
