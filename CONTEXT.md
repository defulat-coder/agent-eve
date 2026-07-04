# Agent Template Context

Reusable language for the Agent platform template. This glossary names product concepts only; implementation decisions stay in code or ADRs.

## Language

**Agent job**:
A queued request to start an Agent run from a prompt and timestamp.
_Avoid_: Task, queue item

**Agent job intake**:
The act of accepting a requested Agent job into the system and returning acceptance metadata.
_Avoid_: Job route, enqueue helper

**Agent runtime**:
A selectable implementation of Agent behavior. The template may include multiple Agent runtimes, but a deployment chooses one through environment configuration.
_Avoid_: Agent type, Agent mode

**Agent run**:
One execution of an Agent from a prompt through the selected Agent runtime. It may be started by Chat SSE or by a queued Agent job.
_Avoid_: Agent work, job result

**Agent run event**:
An event emitted while an Agent runtime executes an Agent run.
_Avoid_: UI timeline item, log line

**Claude Agent runtime**:
A Claude Agent SDK backed Agent runtime.
_Avoid_: Cloud runtime, Claude path

**Eve Agent runtime**:
A filesystem-first Agent runtime shaped by Eve's authored surface.
_Avoid_: Eve-style runtime, Eve clone, file runtime
