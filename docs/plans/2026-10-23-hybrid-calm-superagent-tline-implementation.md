# Hybrid Calm — SuperAgent / T-Line Implementation

Date: 2026-10-23
Scope: T-Line frontend design presets and workbench, terminal grid, plus restrained SuperAgent CLI branding.
Status: Implemented in source; static/type/test QA passed. Live desktop visual QA remains pending.

## Intent
Reduce visual overstimulation without removing tools, history, process visibility, keyboard workflows, or advanced monitoring. Hybrid Calm combines Linear-inspired focus hierarchy with Soft Modern surfaces.

## Delivered
- Two opt-in theme presets in T-Line: `Hybrid Calm - Light` and `Hybrid Calm - Dark` (previous themes preserved).
- Scoped `frontend/src/styles/calm.css`: flat backgrounds rather than radial dot/glow, neutral panels, quieter terminal-grid chrome, 14px chat reading text, enlarged sidebar metadata, subtle focus outlines.
- Optional motion minimization: decorative pulse, ping and bounce stopped; spinner motion slowed. `prefers-reduced-motion` honored.
- `Appearance -> Calm comfort`: Comfortable/Compact density and Minimal/Off motion, stored locally.
- Automatically collapse the Live Monitor when entering Calm mode; only Sub Agents remains initially expanded when the monitor is reopened. All sections remain accessible.
- Default process/tool details collapsed in Calm mode; native keyboard-accessible expansion buttons with `aria-expanded`.
- Responsive overlays for history/monitor on narrow viewports, so the conversation remains central.
- SuperAgent CLI banner and working indicator simplified: remove high-frequency 100ms color cycling.

## Theme colors and default contrast
| Theme | Workspace | Sidebar | Foreground | Muted | Accent |
|---|---|---|---|---|---|
| Light | #F8F9FB | #F0F2F5 | #242B38 | #586578 | #5369A5 |
| Dark | #1B2029 | #171B23 | #F0F2F7 | #B8C3D2 | #8095D3 |

AA contrast ratios, workspace against foreground / muted / accent:
- Light: 13.49 / 5.62 / 5.07
- Dark: 14.59 / 9.16 / 5.57

Values are for default presets only. Custom accent colors still need user-specific contrast validation.

## Where to use
1. Open T-Line.
2. Go to Settings -> Appearance -> Theme Preset.
3. Select Hybrid Calm - Light or Hybrid Calm - Dark.
4. In Calm comfort, select Information density and Interface motion.
5. Open Live Monitor on demand through the existing monitor toggle.

## Verification
- `cd frontend && bun --bun x tsc --noEmit --pretty false` — pass.
- `bun run build:frontend` — pass (pre-existing-style Vite CSS warning and bundle-size advisory observed).
- Full frontend Vitest suite — 45 test files / 193 tests passed with `--maxWorkers=2` after final additions.
- Dedicated HybridCalmTheme tests — 6 passed, including preference persistence, theme picker interaction and default color contrast checks.
- `bun --bun x tsc --noEmit --pretty false` in SuperAgent CLI repo — pass.

## Pending manual review / follow-up
- Live Tauri/Electron UI review across light/dark, normal/compact, 100%/200% zoom, and narrow screens. On audit, neither ports 5773 (frontend) nor 5779 (backend) was listening; CDP desktop target unavailable. Do not claim screenshot/visual regression sign-off.
- Verify custom accent choices for contrast and check keyboard/focus order in actual desktop app.
- Vite generated scrollbar-selector CSS-minifier warning and bundle-size advisories should be triaged separately; frontend production build succeeds.
- Full suite with unrestricted workers intermittently fails the unrelated StudioPresetPanel test (synchronous assertion before async status paint); its standalone test and bounded-worker full suite both pass. No unrelated Studio source was changed.
- Audit remaining deeply nested Studio, Brain Explorer, Settings and MCP panels against new tokens in a full visual pass; the theme is applied globally, but every nested element has not yet undergone manual review.

## Change boundaries
Only designated Hybrid Calm files were edited; other in-flight README, CI, CLI core and runtime changes in the two repositories were deliberately left untouched.
