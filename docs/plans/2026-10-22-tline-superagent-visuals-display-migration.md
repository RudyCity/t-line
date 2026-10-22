# T-Line — SuperAgent Visuals display rename (provisional)

Date: 2026-10-22

## Scope

- Working display label changed from **Motion Studio** to **SuperAgent Visuals** in the T-Line navigation, new scene tab title, empty workspace button, editor heading and user-facing HTTP/authentication messages.
- Name is **not cleared as a registrable trademark**; approval and PDKI/WIPO searches plus legal review remain a requirement before advertising or publicly distributing the new mark.
- Keep every technical contract stable: the internal React `MotionStudioTab` component, tab `type: motion`, session ID pattern `motion-*`, SuperAgent's `/api/motion` routes and `superagent motion` commands. No schema/storage migrations.
- `frontend/src/services/motionBranding.ts` is the editable display-name source for future brand approval.
- Existing historical documentation and tests may use the original Motion Studio wording as historical context; do not rewrite Git history.

## Content sourcing

Do not load or port external motion-template packs. Curated native templates show optional `origin: superagent-original` provenance from the backend. This policy applies to **motion templates/effects**, not to runtime libraries, codecs, FFmpeg or user-provided media. Keep their license and IP checks intact.

## Verification

Run `cd frontend && bun x vitest run src/services/__tests__/motionBranding.test.ts src/components/__tests__/MotionStudioTab.test.tsx && bun run build` and relevant backend proxy tests. The display change is safe for currently saved Motion projects.
