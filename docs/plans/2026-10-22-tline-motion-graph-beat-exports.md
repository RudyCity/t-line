# Native T-Line Motion Studio — Graph, Beat Sync, GIF/WebM

Date: 2026-10-22
Status: Native editor integration complete and tested; packaged app smoke pending.

- `MotionGraphEditor` renders a sampled SVG curve for selected timeline track and saves changed numeric value through canonical revisioned `set-track`.
- `MotionBeatSyncPanel` targets a selected layer and WAV clip with adjustable pulse intensity, a non-persistent Preview in the same MotionCanvas/Timeline, and explicit Apply/Undo.
- `MotionExtraExportPanel` appears for completed jobs when the SuperAgent capabilities report extra formats. It requests conversions via backend-only authenticated proxy, makes local object URLs, exposes GIF/WebM downloads, revokes URLs when job changes and shows errors on failures.
- Backend proxy allowlists only the documented beat-sync and extra-export URLs; converter credentials never reach renderer.
- Known bounds: beat sync is transient-based and replaces an opacity animation; GIF/WebM transcode is limited to clips <=20s / <=16 MB.
- End-to-end packaged Tauri + live SuperAgent/FFmpeg export smoke remains outstanding.
