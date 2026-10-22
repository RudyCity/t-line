# T-Line Motion Studio — Workspace Brand Kit and Scene Templates

Date: 2026-10-22
Status: Implemented / integrated, unit tested and Bun-built. Packaged app test outstanding.

- `MotionBrandKitPanel`: workspace-specific brand name, palette, curated font, uploaded local logo with explicit versioned save and conflict errors.
- `MotionTemplatePanel`: six templates, optional headline/subtitle, server-backed nonpersistent Preview, explicit Apply.
- The native MotionCanvas and MotionTimeline use a single temporary preview composition; preview is read-only, and async results are discarded when the project/revision/parameters change.
- Scene template Apply uses SuperAgent's authoritative revision-checking and T-Line Undo/Redo. Saving is never triggered by mere preview or color changes.
- The existing T-Line proxy whitelists only documented `/brand-kit`, `/templates`, and `/projects/:id/templates[/preview]` endpoints with workspace authorization and server-held credentials.
- Tests: `MotionBrandKitPanel.test.tsx`, `MotionTemplatePanel.test.tsx`, `MotionStudioTab.test.tsx`, and backend `motionProxy.test.ts`.
- Caveat: Template Apply replaces the composition layer layout; prior layout can be restored through Undo or previously committed recovery snapshots.
