# T-Line Phase 2B-2 — Executor Receipt Visibility

Date: 2026-10-26. Integrates with SuperAgent Core's detached task journal.

Activity Center → Tasks → Checkpoint now displays the number of **executor receipts** and **missing receipts**. Every `receipted` event has a provenance label:

- **Local adapter receipt**: local read adapter returned. Not proof of model resumability.
- **External adapter · not provider verified**: network adapter returned, but external effects/commit still cannot be independently confirmed.

UI capability is backward compatible: `receiptCount`, `missingReceipts`, `receiptRef`, and `receiptProof` are optional in the typed API because older Core versions may not yet provide them. Missing receipt for a completed call now keeps Core `manualReviewRequired` true and gates Retry-as-New-Draft with latest evidence revision confirmation. The user must separately Run any new draft.

No automatic tool replay, no running-model Resume, no provider-confirmed remote receipts, and no changes to Muse.

Checks:
```sh
bun run build:frontend && bun run build:backend
cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/AssistantTaskDraftPanel.test.tsx
```

Pending: external-service-specific idempotency contracts, signed/queried provider receipts, and packaged Tauri + real provider crash recovery E2E.
