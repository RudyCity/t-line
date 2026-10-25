# Studio P8 — Rejected Frame Evidence UI

Date: 2026-10-26
Status: developer preview; read-only inspection of rejected video.

On a shape reconstruction failure with P6's **explicit frame number**, T-Line retains the previously imported workspace video identifier in this panel session and shows **Review rejected video frame**. The user may inspect the flagged frame or choose another bounded frame (0–359); T-Line fetches exactly three reference frames through authenticated `/reconstruct/multi/evidence`, displays a contact sheet with observed component boxes, and lists Before/Flagged/After component counts.

**No project** is created by this inspection. It cannot override P6's fail-closed occlusion detection, provide identity recovery, or modify existing layer tracks. Current P7 manual correction remains available only after a successfully reconstructed project.

The client validates the response and bounded PNG magic/bytes, creates a browser-owned object URL, revokes it during replacement/unmount, and drops stale workspace-switch responses. Old Studio backends without the route remain usable; user sees an API error instead of fabricated evidence.

Validation: dedicated authenticated client tests, component tests with 2 → 1 → 2 occlusion sequence and revoked PNG URL, frontend build and full Studio regression. Direct installed T-Line WebView2 click-through, real-video evaluation and shipping NSIS installer remain unverified.
