# T-Line — SuperAgent Studio command

Date: 2026-10-22
Status: implemented and tested.

- The canonical visual editor display name is **SuperAgent Studio** (previously the temporary label SuperAgent Visuals).
- T-Line console accepts `/studio` and `/studio open` to open the native Studio tab for the current workspace, using the existing `openMotionTab` callback.
- `/studio help` explains the desktop shortcut and scriptable CLI. Other `/studio <action>` inputs show CLI guidance rather than triggering unintended operations.
- The generated command parity catalog lists `/studio` as a `local-ui-handler` and does not list `/motion` as a user-facing command.
- The console editor's `type: motion`, T-Line `/api/superagent/motion` proxy and SuperAgent backend `/api/motion` stay intact for existing saved project/session compatibility.
- Production Tauri bundle needs a normal rebuild to include this frontend change; this update does not restart the active app.

Verification: `bun scripts/audit-superagent-parity.cjs --check`, `cd frontend && bun x vitest run src/components/__tests__/SuperAgentCliParity.test.ts src/services/__tests__/motionBranding.test.ts && bun run build`.
