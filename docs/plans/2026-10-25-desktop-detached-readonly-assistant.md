# Desktop detached assistant: explicit read-only execution — 2026-10-25

T-Line remains a specialized UI/transport for **one SuperAgent Core**. This increment enables the existing **Assistant tasks** draft panel to explicitly start a Core-owned read-only analysis worker. It does not copy the agent implementation into the desktop backend, change remote messaging channels or execute drafts automatically.

The UI displays the journal state, live ownership, unverified orphan warning and saved completion result. **Run** requires user confirmation, **Cancel** is guarded by the current CAS revision and **Result** reads the server-owned artifact. The existing **Assistant queue** still represents serialized interactive chat turns, not these independent tasks.

All actions pass through the authenticated local operator proxy under `/api/superagent/assistant/tasks`: GET list/events/inspect/result, POST create/run/cancel. The proxy forwards only fixed paths, the owning session/workspace, expected revision and a service token. No user-provided shell command or tool invocation endpoint is exposed.

The default task policy is `read-only-explicit-run`; the UI hides Run for an older Core that does not advertise this capability. Sessions and workspaces remain isolated. If Core dies mid-execution, the task becomes unverified rather than being automatically rerun.

**Not yet provided:** durable workers surviving Core exit, mutating coding workers, operator steering into already-running independent tasks, real provider/CDP packaged E2E. Implement these only after explicit approval and scope isolation of tool actions. Muse stays unchanged.
