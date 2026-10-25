# Desktop reviewable patch workflow — 2026-10-25

T-Line now connects to the existing Core session-scoped isolated patch endpoints. In **Assistant tasks**, draft a code change, select **Patch** and approve, then continue the main chat while the Core builds an isolated patch proposal.

- **Patch**: start a read-only model proposing a unified diff. Core applies it only to its own detached Git worktree after path checks.
- **Review patch**: display the verified diff as plain text from the completed, owner/workspace-scoped result. It does not apply or merge.
- **Reconcile**: explicitly mark orphaned running/planning tasks interrupted with revision CAS. No automatic replay, no adoption or claimed successful completion.
- **Cancel**: now uses the correct explicit `/:taskId/cancel` API path, not the task inspection path.
- Older Cores hide the Patch action if `supportedModes` does not advertise `patch-preview`.

Fixed operator-only proxy routes: GET `/:id/patch`; POST `/:id/prepare`, `/:id/reconcile`. Client IDs, query session, and workspace stay tied to the active T-Line session. Model/provider credentials and arbitrary command/tool payloads are never forwarded.

**Limits:** source must be a local Git repository root with a commit; patch changes must target tracked files and pass Git validation; no auto-merge or real mutating worker. The Core process still owns each running agent, so a Core restart requires manual reconciliation. Verified by unit/integration with local Git fixture; no live-provider or packaged desktop E2E success claimed. Muse remains unchanged.
