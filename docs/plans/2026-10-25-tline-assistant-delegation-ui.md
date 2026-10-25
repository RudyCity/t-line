# General-purpose assistant UX and chat-to-task delegation
Date: 2026-10-25

## Scope

This increment changes **T-Line desktop UI only**, reusing the domain-aware SuperAgent Core and its existing session-scoped task APIs. Muse, Telegram, task worker permissions, MCP/CDP tools, and independent core lifecycle are untouched.

## Experience

1. Type a natural-language request into the main T-Line chat composer.
2. Choose **Delegate** rather than **Send** to open the assistant task workspace above the composer, pre-filled with the exact text. The chat input is preserved until the task is successfully saved.
3. Pick a capability chip (General Assistant / Research / Analysis / Planning / Files & Documents / Coding). Descriptions and capability labels come from Core, with analysis-only fallback for older Cores.
4. **Add draft** saves the task but does **not** start any agent; choose **Run task** to explicitly launch the bounded read-only worker. Coding alone additionally offers **Prepare patch** with Git worktree isolation.
5. Task cards show the domain, clear active/completed/failed status, guarded actions, and an obvious **Result** panel. Filter by All / Active / Completed / Needs review; copy verified result text. Orphaned work remains review-required and never auto-replays.

## UI details

- Calm/modern dark/light theme integration via existing design tokens, with soft borders, rounded cards, keyboard-visible focus and domain icon chips.
- Responsive layout: single-column task cards on narrow screens, two columns on wider screens, wrapping domain picker, 60vh bounded scroll inside the accordion. Chat input and main thread remain available.
- Composer has distinct **Send** (same-session serialized chat turn) and **Delegate** (independent task draft) actions. Delegate is disabled without a live session, without text, or with attached files (detached task API is text-only). No implicit prompt conversion or background execution.
- Handoff is bound to the active `workspace + sessionId`, and cannot be carried into another chat session. Editing a delegated draft before saving does not erase the original chat text. A successful matching save clears the duplicated chat input; failed saves preserve both copies.
- Manual refresh and scheduled status polling **never clear unsaved task text or the selected domain**. Only workspace/session changes reset private in-progress state; polling responses from older overlapping requests are ignored.
- Plain text result rendering: no unsafe HTML or injected script execution. Patch artifacts show an explicit *not applied* label.

## Verification

Build: `bun run build:frontend`.

Frontend tests:
`cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/AssistantTaskDraftPanel.test.tsx src/components/__tests__/SuperAgentAssistantComposer.test.tsx src/components/__tests__/AssistantTaskDraftApi.test.ts src/components/__tests__/AssistantTurnQueue.test.tsx`.

Backend fixed API tests:
`bun --bun x vitest run backend/tests/assistantTaskProxy.test.ts backend/tests/tlineAssistantTurns.test.ts`.

Tests cover handoff, continued chatting, blocked attachments, explicit run confirmations, filter actions, read-only boundaries, unsaved draft retention across refresh, failed-save retention, domain capabilities and task ownership.

## Remaining

An actual packaged Windows desktop / CDP browser GUI session has **not** been exercised here (Chrome CDP had no T-Line tab at verification). Real model-provider execution, OS accessibility/keyboard navigation, screen reader walkthrough, mobile emulation and high-DPI visual QA still require staging verification. Separate workers remain Core-process owned. This UI does not add browser/computer automation or auto-approval.
