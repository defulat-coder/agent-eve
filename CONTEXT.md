# Agent Template Context

Reusable language for the Agent platform template. This glossary names product concepts only; implementation decisions stay in code or ADRs.

## Language

**Agent job**:
A queued request to run Agent work from a prompt and timestamp.
_Avoid_: Task, queue item

**Agent job intake**:
The act of accepting a requested Agent job into the system and returning acceptance metadata.
_Avoid_: Job route, enqueue helper
