# Motion Studio: Non-Destructive Effects Stack (P0)

Status: implemented and test-verified in source, requires packaged desktop smoke test.
Date: 2026-10-22

- SuperAgent is the single authority for `composition.stackBase` and the ordered `effectStack`.
- Source tracks persist; previews and renders use the same compiled layer representation.
- T-Line uses the authenticated workspace proxy `/projects/:id/effect-stack` for add, remove, toggle, move and update transactions.
- All modifications include `baseRevision` for optimistic locking; old revisions fail HTTP 409.
- Preview endpoint `/projects/:id/effect-stack/preview` computes without writing.
- T-Line Effects Library applies effects into the stack when `nondestructiveEffectStack` is reported. Legacy SuperAgent builds fall back to ordinary baked effects.
- T-Line Effect Stack inspector supports toggle, ordering, deleting and editing duration/parameters. It participates in the existing scene Undo/Redo history.
- Existing scene compositions without stack metadata remain compatible.
- Tests: SuperAgent `motionEffectStack` and `motionEffectsHttp` 8/8; T-Line frontend targeted 27/27; proxy/backend 6/6.

Limits: individual effects can still be compiled to keyframes, not GPU shader nodes. Compound presets remain baked. Packaged Tauri smoke test and refresh of the live server were not performed in this coding session. Recovery/autosave and remaining P1/P2 features tracked separately.
