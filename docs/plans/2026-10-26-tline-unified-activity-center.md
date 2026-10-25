# Unified Activity Center — desktop implementation and safety verification
Date: 2026-10-26

## Goal and implementation

A single, collapsible **Activity Center** appears between the retained Core task monitor and the main T-Line chat input, replacing two separate independent footer accordions. The activity header reports the current session's chat-queue and detached-task counts, including attention-required items. It has accessible tabs:

- **Chat queue**: reads existing retained Core turn records. Shows running, pending, recoverable, interrupted and completed chat-turn states. A recoverable **never-started** turn may be resumed only through an explicit confirmation and the existing Core recovery route; interrupted operations are never replayed automatically.
- **Background tasks**: reuses the existing domain picker, explicit Add draft/Run, isolated coding patch preview, result view, cancellation and scoped orphan reconciliation. No domain gains extra permissions.

The task handoff from the main composer opens Activity Center on the Background tasks tab. The chat input is not cleared until an identical submitted draft is saved successfully; no background action starts automatically.

## UI and state handling

- Visual style: existing calm design variables, responsive/wrapping source tabs, rounded status cards and bounded-height scroll. Detail status panels use accessible labels and a visible distinction between queued versus running operations.
- Counts are **read-only summaries**, never command triggers. The term 'active' includes queued detached drafts; it is not represented as running execution. "Needs review" combines recoverable chat turns with interrupted/orphaned/failed detached tasks without merging their recovery paths.
- Source snapshots are loaded via **separate, authenticated workspace/session-scoped APIs**. Polling is bounded, does not start extra work and ignores late out-of-order results; if one API is unavailable, the other can still update, with the unavailable source marked delayed while last-known counts remain visible.
- Keeping inactive detail tab components mounted preserves an unfinished draft when switching tabs. Keeping the entire Activity Center subtree mounted while collapsed preserves draft text on collapse/reopen. **Only the currently visible detail tab polls**; the single compact summary continues to refresh when the window is visible.
- The detail APIs and Core dispatchers are not merged. T-Line's existing message queue remains strictly ordered within a session; detached tasks remain separate and explicitly approved.

## Regression evidence

```sh
bun run build:frontend
cd frontend && bun --bun x vitest run --config vite.config.ts \
  src/components/__tests__/AssistantActivityCenter.test.tsx \
  src/components/__tests__/AssistantTurnQueue.test.tsx \
  src/components/__tests__/AssistantTaskDraftPanel.test.tsx \
  src/components/__tests__/SuperAgentAssistantComposer.test.tsx \
  src/components/__tests__/AssistantTaskDraftApi.test.ts
```

Covers aggregation, source-failure degradation, unauthorized session handoff ignored, independent status tabs, composer handoff, read-only boundaries, recoverable vs interrupted turn handling, draft preservation across tab/accordion changes, and older Core compatibility. Both T-Line and SuperAgent Core execution remain unchanged. No files in Muse are touched.

## Known limitations and follow-up

- Core still owns the actual execution and model-provider work. Unit/integration UI tests and Vite build are **not** a packaged desktop GUI/live-model-provider E2E validation.
- UI status summary and the visible detail view have independent polling cycles; periodic confirmation should use correlated revisions if a future Core endpoint offers an atomic combined read-only snapshot.
- A graphical Windows desktop visual check is required for 320px widths, HiDPI, keyboard-only tab navigation and themes when T-Line is running.
- This does not enable unapproved browser/computer control or automated replay of side effects.
