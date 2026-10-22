# T-Line Native Advanced Typography

Date: 2026-10-22
Status: Implemented; TypeScript/Vite builds and targeted tests passed. Packaged Tauri smoke outstanding.

`MotionTypographyPanel` provides:
- Letter Reveal or Word Rise, start frame and duration.
- Explicit nonpersistent preview on the shared read-only Motion Canvas + Timeline.
- Apply saves through the revisioned SuperAgent project API and joins native Undo/Redo.
- Prevents applying to non-text layers and invalid timeline windows.
- When a layer has dependent effect-stack entries, SuperAgent requires removing those entries before splitting text; it fails without saving and surfaces an actionable message.
- No arbitrary SVG markup, CSS injection, font-file uploads, GPU shaders or scripts.
