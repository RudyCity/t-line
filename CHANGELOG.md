# Changelog

All notable changes to the **t-line** workspace manager project will be documented in this file.

## [1.3.599] - 2026-07-21

### Agent Skills & Customization
- **Feature Gap & Bottleneck Analysis Skill (`.agents/skills/feature-gap-bottleneck-analysis/SKILL.md`)**:
  - Added new workspace skill designed for systematic scanning and detection of missing features, functional gaps, performance bottlenecks, technical debt, and security flaws across codebases.
  - Implemented 4-phase audit workflow (Scope Discovery, 5-Vector Audit Matrix, Impact vs Effort Scoring, and Structured Action Plan with concrete before/after diff solutions).

## [1.3.598] - 2026-07-21

### UI/UX & Theme Customization
- **Full SuperAgent Theme Variable Integration (`SuperAgentConsole.tsx`, `SuperAgentInputContainer.tsx`, `SuperAgentMessageItem.tsx`, `SuperAgentGroupedMessages.tsx`, `SuperAgentToolItem.tsx`, `SuperAgentInteractiveCards.tsx`, `SuperAgentHistorySidebar.tsx`, `SuperAgentSidebar.tsx`, `ActiveTasksBar.tsx`, `SubAgentTerminalModal.tsx`, `SuperAgentSettingsModal.tsx`, `SuperAgentSettingsMenu.tsx`, `SuperAgentPresetManager.tsx`, `SuperAgentLoginManager.tsx`, `SuperAgentAuditLogs.tsx`, `components.css`)**:
  - **Dynamic Theme Palette**: Replaced all hardcoded hex (`#090c14`, `#05070c`, `#121622`) and static Tailwind color classes (`bg-indigo-600`, `text-indigo-400`, `border-zinc-800`) with root design CSS variables (`var(--bg-main)`, `var(--bg-sidebar)`, `var(--bg-card)`, `var(--panel-header-bg)`, `var(--border-color)`, `var(--color-primary)`, `var(--color-primary-hover)`, `var(--color-primary-glow)`, `var(--text-main)`, `var(--text-muted)`).
  - **Visual Consistency**: SuperAgent UI elements (headers, popovers, chat prompt boxes, message cards, tool execution items, live monitor sidebar, settings modals, and audit logs) now inherit and automatically adapt to any active application theme (Default Dark, Dracula, Cyberpunk, Forest, Nord, Light Mode).

## [1.3.597] - 2026-07-21

### UI/UX & Redesign
- **Redesign & Relayout Top Console Header Bar (`SuperAgentConsole.tsx`)**:
  - **Segmented Tab Control**: Transformed `Console` and `Audit Trails` into a modern, rounded segmented control with `Terminal` & `Shield` icons and glowing active indicator states.
  - **Balanced 3-Column Layout**: Improved alignment and spacing across History toggle, Active Workspace pill badge, Tab Switcher, Live Monitor, and Setting buttons.
  - **Hallmark Aesthetic Polish**: Applied sleek dark theme accents (`bg-[#090d16]`, subtle borders, micro-interactions, responsive flex wrapping).

## [1.3.596] - 2026-07-21

### Performance & Optimization
- **Pagination & Instant Item Click Optimization (`SuperAgentAuditLogs.tsx`)**:
  - **Click Lag Optimization**: Extracted individual log cards into a memoized `AuditLogItem` (`React.memo`) with localized expansion and view state. Clicking to expand/collapse an item now re-renders **only** that specific item rather than triggering full DOM list reconciliation.
  - **Pagination Control**: Added full pagination support (15, 25, 50, 100 rows per page) with page jump controls (`First`, `Prev`, `Next`, `Last`). Auto-resets page index on search query or category filter changes.

## [1.3.595] - 2026-07-21

### Features & Redesign
- **Redesign SuperAgent Audit Logs (`SuperAgentAuditLogs.tsx`)**:
  - **Hallmark Aesthetics & Anti-AI-Slop**: Implemented sleek dark theme palette with distinct visual hierarchy, color-coded status borders, and category badges for Prompts, Decisions, Agent events, System operations, and Errors.
  - **Pragmatic Minimalism**: Built clean, structured, and fast viewer without adding extra third-party dependencies.
  - **Cognitive Scaleup Trace & Decision Intelligence**: Added categorized filter pills, real-time auto-polling toggle, full text search, human-readable log summaries, collapsible detail view with togglable Structured vs Raw JSON display, and 1-click JSON export/copy.

## [1.3.594] - 2026-07-21

### Fixed
- **Support thinking/reasoning events rendering (`SuperAgentConsoleUtils.ts`, `sessionManager.ts`)**:
  - **Root Cause**: `extractEventText` tidak mengekstrak field `reasoning`, `thought`, `thinking`, atau `delta` pada event streaming. Akibatnya event `type: 'thought'` / `type: 'reasoning'` menghasilkan text kosong `""` dan tidak dirender ke dalam Process Steps.
  - **Fix**: Diperbarui `extractEventText` dan pengenalan event `isThoughtType` di `SuperAgentConsoleUtils.ts` untuk mendukung seluruh bentuk event reasoning/thought/thinking.
  - **History Fix**: Diperbarui `sessionManager.ts` pada backend agar mendukung ekstraksi field `rawMsg.thought` dan `rawMsg.thinking` saat memuat histori.

## [1.3.593] - 2026-07-21

### Features
- **Allow empty chat history list (`useSuperAgentSessions.ts`, `SuperAgentConsole.tsx`)**:
  - Riwayat chat kini diperbolehkan kosong (0 items) tanpa otomatis memaksa membuat "New Chat" sintetis pada `loadWorkspaceSessions` maupun setelah semua chat dihapus.
  - Sesi chat baru akan otomatis dibuat secara dinamis saat pengguna mengirimkan prompt atau menekan tombol `+` (New Chat).

## [1.3.592] - 2026-07-21

### UI/UX
- **Remove left border from history chat items (`SuperAgentHistorySidebar.tsx`)**:
  - Menghapus `border-l-2 border-indigo-500` / `border-l-2 border-transparent` pada item riwayat chat di sidebar kiri agar tampilan list item terlihat lebih bersih dan seamless.

## [1.3.591] - 2026-07-21

### Fixed
- **Process Step wajib semua tools tampil (`SuperAgentConsoleUtils.ts`, `sessionManager.ts`, `useSuperAgentSessions.ts`)**:
  - **Live streaming tool start matching**: Perbaiki logika `setMessages` pada `handleAgentEventPayload` di `SuperAgentConsoleUtils.ts` agar event `tool_start` / `tool_call` / `tool_use` tidak menggunakan Priority 2 fallback yang dapat menimpa tool yang sedang berjalan sebelumnya. Setiap tool call baru kini di-append dengan aman sehingga semua tool steps tampil lengkap di Process Steps.
  - **History reload tool retention**: Perbaiki `sessionManager.ts` di backend agar `isNoiseMessageContent` tidak membuang message ber-role `'tool'` atau `'thought'` saat memuat histori dari SuperAgent HTTP Server.
  - **System noise guard**: Tambahkan pengecualian eksplisit untuk role `'tool'` dan `'thought'` pada `isSystemNoiseMsg` di `useSuperAgentSessions.ts` agar tidak ada tool step yang tersaring sebagai system noise.
  - **TypeScript interface fix**: Perbarui `SuperAgentToolItemProps` pada `SuperAgentToolItem.tsx` untuk menyertakan role `'connection'`.

## [1.3.590] - 2026-07-21

### Performance
- **Fix streaming latency: t-line sekarang secepat CLI (`superAgentBridge.ts`)**:
  - **Root cause #1 (kritis)**: `logSuperAgentEvent()` sebelumnya melakukan `fs.readFileSync` seluruh file → `JSON.parse` semua entries → `JSON.stringify(null, 2)` → `fs.writeFileSync` seluruh file **pada setiap SSE event** (termasuk setiap token streaming). Ini memblokir Node.js event loop puluhan kali per detik.
    - **Fix**: Ganti ke format **NDJSON append-only** (`fs.appendFileSync` 1 baris JSON per event). File read-write penuh hanya terjadi saat rotasi (>2MB). File audit berganti dari `superagent-audit.json` → `superagent-audit.ndjson`.
    - `getAuditLogs()` diperbarui untuk membaca NDJSON, dengan fallback ke format lama `.json` untuk backward compatibility.
  - **Root cause #2**: SSE relay melakukan `JSON.parse(dataStr)` lalu `JSON.stringify(event)` tanpa perlu — data sudah berupa JSON string valid dari SuperAgent.
    - **Fix**: Kirim `dataStr` langsung ke WebSocket (`ws.send(dataStr)`). Parse hanya dilakukan untuk audit logging dan `LOG_STREAM_RESPONSE` mode.
  - **Root cause #3**: High-frequency streaming events (`text_delta`, `thought`, `reasoning`, `tool_start`, `tool_progress`) tidak perlu masuk audit log — hanya noise.
    - **Fix**: Skip `logSuperAgentEvent()` untuk event types tersebut via `AUDIT_SKIP_INNER_TYPES` set.
  - **Root cause #4**: Nagle algorithm TCP buffering pada koneksi loopback `127.0.0.1:7888` menambah latensi ~200ms untuk setiap packet token kecil.
    - **Fix**: Tambah `socket.setNoDelay(true)` setelah koneksi SSE berhasil.

## [1.3.589] - 2026-07-21

### Fixed
- **`ActiveTasksBar` tidak muncul di atas input (`SuperAgentConsole.tsx`)**:
  - Bug: `ActiveTasksBar` ditempatkan **di dalam** `div ref={messagesContainerRef}` yang punya `overflow-y-auto`, sehingga bar ikut tergulir bersama chat messages dan tidak terlihat di atas input.
  - Fix: Dipindahkan ke luar scroll container, di antara `messagesContainerRef` dan `SuperAgentInputContainer`, sehingga selalu tampil pinned di atas area input.
- **`PlanCard` bisa auto-approve / `handlePlanApproval` terpanggil tanpa state valid (`SuperAgentConsole.tsx`)**:
  - Bug: `handlePlanApproval` hanya mengecek `!ws` sebelum mengirim `approve_plan` ke server, sehingga bisa terpanggil meskipun `pendingPlanApproval` sudah `false` (race condition / stale closure).
  - Fix: Ditambahkan guard `if (!pendingPlanApproval || !ws) return` agar approve/reject hanya bisa dikirim saat plan card memang sedang aktif ditampilkan.

## [1.3.588] - 2026-07-21

### Changed
- **SuperAgent Permission & Plan Approval Card Redesign (`SuperAgentInteractiveCards.tsx`)**:
  - Redesigned both the `PermissionCard` and `PlanCard` components to adhere to Hallmark minimalist design guidelines.
  - Implemented clean, themed dark containers (`bg-[#0d0a07]` for amber/permission warning and `bg-[#090d16]` for indigo/plan approval).
  - Integrated modern pulsing active beacon states and proper responsive borders.
  - Refined buttons with hover transformations, active click states, and clean borders.

## [1.3.587] - 2026-07-21

### Changed
- **SuperAgent Question Card Redesign (`SuperAgentInteractiveCards.tsx`)**:
  - Redesigned the agent question-answering card to adhere to Hallmark minimalist design guidelines.
  - Added modern, styled custom checkboxes and radio buttons with smooth transition states.
  - Replaced native inputs with a custom flex-aligned layout containing active ring borders and dot/checkmark indicators.
  - Integrated status indicator animations (pulsing green/indigo dot) and proper spacing.

## [1.3.586] - 2026-07-21

### Improved
- **SubAgent Terminal Modal Status Badge (`SubAgentTerminalModal.tsx`)**:
  - Added explicit red badge styling for `ERROR` and `FAILED` subagent execution statuses in the SubAgent terminal modal header.

## [1.3.585] - 2026-07-21

### Changed
- **Default Terminal Stream Response Logging Disabled (`superAgentBridge.ts`)**:
  - Wrapped terminal stream log output in a `process.env.LOG_STREAM_RESPONSE === 'true'` check.
  - Stream response terminal logging is now disabled by default and can be enabled on-demand when `LOG_STREAM_RESPONSE=true`.

## [1.3.584] - 2026-07-21

### Added
- **Stream Response Logging to Terminal (`superAgentBridge.ts`)**:
  - Added stdout/console logging for SSE stream response events (`text_delta`, `message`, `tool_call`, `tool_result`, and execution events).
  - Stream response events arriving from SuperAgent are now formatted and displayed live in the backend terminal console output.

## [1.3.583] - 2026-07-21

### Changed
- **Default Expanded Tool Use in SuperAgent Chat (`SuperAgentGroupedMessages.tsx`)**:
  - Updated `CollapsibleProcessBlock` in SuperAgent chat UI so process steps and tool usage default to expanded (`expanded = true`) across active and historical chat turns.
  - Removed auto-collapsing on response completion, ensuring tool execution steps (`Read file`, `Ran command`, `Searched`, etc.) remain visible by default in SuperAgent chat log.

## [1.3.582] - 2026-07-21

### Fixed
- **Normalized Session ID Matching (`SuperAgentConsoleUtils.ts`, `SuperAgentGroupedMessages.tsx`)**:
  - Added `isMatchingSessionId()` helper to normalize session ID prefixes (`session_`, `sess_`, `workspace::`) so live streaming events match regardless of ID prefix variations.
  - Updated `SuperAgentGroupedMessages.tsx` so process/thinking block expansion checks `isStreaming && isLastTurn`, keeping process steps open during the active turn until the assistant response completes.

## [1.3.581] - 2026-07-21

### Changed
- **Live Process & Thinking Step Auto-Expansion (`SuperAgentGroupedMessages.tsx`)**:
  - Updated `CollapsibleProcessBlock` to automatically stay open/expanded while an agent is actively running or streaming (`isStreaming = true`).
  - Tool calls, execution reasoning, and thoughts remain visible live during turn execution, and automatically collapse into a summary pill only after the final assistant response completes.

## [1.3.580] - 2026-07-21

### Fixed
- **New Chat Session Event Isolation & Mismatch Filter (`SuperAgentConsoleUtils.ts`, `server.ts`, `agent.ts`)**:
  - Fixed an issue where clicking "New Chat" caused stray `done` / `[Interrupted]` events from the old aborted session to prematurely stop loading for new chat responses.
  - Added `sessionId` metadata tracking to `Agent` and `server.ts` `onEvent` emissions.
  - Added `activeSessionId` filtering in `SuperAgentConsoleUtils.ts` to discard stray background events belonging to inactive/previous sessions.

## [1.3.579] - 2026-07-21

### Fixed
- **Chat Output Print Stream Bug Fix (`SuperAgentConsoleUtils.ts`, `SuperAgentConsole.tsx`)**:
  - Added safe `extractEventText()` helper to handle array/object content payloads (`[{ type: 'text', text: '...' }]`) without throwing `TypeError: chunk.startsWith is not a function`.
  - Optimized chat scroll behavior during active text streaming: uses instant `'auto'` scroll during stream arrival to prevent smooth-scroll animation queue stutter and lag.

## [1.3.578] - 2026-07-21

### Fixed
- **Instant New Chat Session Title Synchronization (`useSuperAgentSessions.ts`, `historyDb.ts`)**:
  - Fixed a bug where a new chat session title defaulted to "New Chat" and only updated after opening/clicking the session.
  - Added title preservation in `useSuperAgentSessions.ts` `syncSessions()` so background session list syncing doesn't overwrite generated session titles with "New Chat".
  - Updated `historyDb.ts` in SuperAgent to invalidate `clearHistoryCache()` immediately when session history is saved or deleted, eliminating 30-second stale session list cache delays.

## [1.3.577] - 2026-07-21

### Added
- **Dual Client Mode Support for SuperAgent (`server.ts`, `superAgentBridge.ts`, `sidepanel.js`)**:
  - Added support for `chrome-extension` and `tline` client modes in SuperAgent HTTP Server.
  - SuperAgent server dynamically configures system prompt and toolsets based on client mode (`CHROME_EXTENSION_SYSTEM_PROMPT` + `chromeExtensionToolset` for Chrome extension; `superagentToolset` / `masterToolset` for `tline`).
  - Updated `superAgentBridge.ts` to spawn SuperAgent with `--client-mode tline` and pass `x-client-mode: tline` HTTP header and payload for all bridge requests.

## [1.3.576] - 2026-07-20

### Fixed
- **SuperAgent Plural Tool Results Extraction (`sessionManager.ts`, `SuperAgentConsoleUtils.ts`)**:
  - SuperAgent stores and streams tool execution outputs as `toolResults` (plural array). Added extraction for `toolResults` / `tool_results` array properties across history session loading and live SSE event handlers so historical tool outputs are never lost or evaluated to `undefined`.

## [1.3.575] - 2026-07-20

### Fixed
- **Chat Initial Load Message Order & Smooth Infinite Scroll Up (`sessionManager.ts`, `useSuperAgentSessions.ts`, `SuperAgentConsole.tsx`)**:
  - **Reverse Offset Pagination**: Updated `getSessionMessages` in `sessionManager.ts` so `offset = 0` loads the 50 most recent messages (bottom of chat) in exact chronological order, while scrolling up loads older message chunks backwards without mixing up message history order.
  - **Scroll Position Preservation**: Prevented `scrollIntoView` auto-scroll to bottom from triggering when older messages are loaded into the chat container during top scrolling, calculating relative scroll height (`newScrollHeight - prevScrollHeight + prevScrollTop`) to keep scrolling completely seamless.
  - **Top UI Indicators**: Added a sleek infinite scroll header UI displaying a loading spinner during fetch, an "↑ Load older messages" manual trigger button when `hasMore` is true, and a "Beginning of conversation history" badge when the top of session history is reached.

## [1.3.574] - 2026-07-20

### Fixed
- **SuperAgent Tool Call Pairing & Parameter Preservation (`SuperAgentConsoleUtils.ts`, `sessionManager.ts`)**:
  - Fixed a critical bug where SuperAgent's `toolResult.toolCallId` property was not being extracted during `tool_end` SSE events. This caused `tool_end` to fail matching its corresponding `tool_start` item, resulting in orphaned tool items with missing parameters or un-merged results.
  - Added `toolCallId` property extraction across SSE events and historical session message payloads, ensuring `args` and `result` are seamlessly merged into a single complete tool call item.

## [1.3.573] - 2026-07-20

### Fixed
- **Rich Tool Inspection Panel & Full Height Toggle (`SuperAgentToolItem.tsx`)**:
  - Added a `Full View` / `Compact` toggle button allowing users to un-truncate long tool arguments and outputs without strict scroll height limits.
  - Added real-time status badges (`COMPLETED` / `RUNNING`) and `callId` tracking pill directly inside expanded tool detail headers for complete transparency.

## [1.3.572] - 2026-07-20

### Fixed
- **Unified Tool Event Listener & Target Label Duplication (`SuperAgentConsoleUtils.ts`, `SuperAgentToolItem.tsx`)**:
  - Unified tool event handling across `tool_start`, `tool_call`, `tool`, `tool_end`, `tool_result`, and `tool_output` so single or multi-phase tool SSE events never drop tool results or arguments.
  - Resolved `Read read` label duplication bug by cleanly resolving target filenames/URLs or defaulting to `file` / `workspace` / `command`.
  - Added fallback `Status / Log` block when expanding tool items to guarantee tool invocation status is always visible even when arguments or output are absent.

## [1.3.571] - 2026-07-20

### Fixed
- **Tool Contract Query & Result Display (`SuperAgentToolItem.tsx`, `SuperAgentConsoleUtils.ts`, `sessionManager.ts`)**:
  - Fixed an issue where expanding a tool call item (details contract block) resulted in search queries or tool execution outputs not appearing.
  - Enhanced search query extraction across all field aliases (`Query`, `query`, `pattern`, `search`, `q`, `searchTerm`, `text`, `Prompt`, `prompt`, etc.).
  - Fixed `tool_end` / `tool_result` event parsing to capture raw strings, objects, and nested `toolResult` outputs so tool results reliably populate `msg.result` and display when expanding the tool contract block.
  - Added robust stringified JSON handling for `args` and `result` displaying formatted JSON or fallback string output when expanded.

## [1.3.570] - 2026-07-20

### Fixed
- **SuperAgent Tab Theme Color Alignment (`App.tsx`, `SuperAgentConsole.tsx`, `SuperAgentSettingsModal.tsx`, `SuperAgentPresetManager.tsx`, `TabsDropdown.tsx`, `components.css`)**:
  - Replaced hardcoded `#818cf8` and `indigo` style colors across the SuperAgent tab icon, quick launch button, header mode/navigation pills, and settings modal buttons with dynamic CSS theme variables (`var(--color-primary)` & `color-mix()`). SuperAgent elements now seamlessly adapt to the user's active theme palette.

## [1.3.569] - 2026-07-20

### Fixed
- **Tool Details Parsing & Generic Fallback Bug (`sessionManager.ts`, `SuperAgentConsoleUtils.ts`, `SuperAgentToolItem.tsx`)**:
  - Fixed an issue where tool calls were displaying generic `Tool tool` names and `tool details` text due to missing fields in SSE events and history payloads. Added comprehensive field extraction across `function`, `tool_calls`, `arguments`, `name`, and `content`, as well as smart regex/args inference fallbacks to correctly display tool names (`Read`, `Edited`, `Searched`, `Ran`, `Subagent`), parameters, arguments, and execution outputs.

## [1.3.568] - 2026-07-20

### Fixed
- **Chronological Tool Placement & Stream Sequence Layout (`SuperAgentGroupedMessages.tsx`)**:
  - Restored exact chronological stream sequence placement for process blocks. Tools executed between assistant text streaming chunks are rendered at their exact usage positions in the timeline, grouping sequential tool calls into clean `Process steps` blocks right where they occur.

## [1.3.567] - 2026-07-20

### Fixed
- **Process Steps Consolidation & Tool Count Display Bug (`SuperAgentGroupedMessages.tsx`)**:
  - Fixed an issue where tool steps during a turn were fragmented into separate single-step sub-blocks displaying `Process steps (1 tool step)`. All tool execution and thought steps for a given turn are now consolidated into a single unified `Process steps` block rendered below the assistant text, correctly displaying the total count of tool steps for that turn (e.g. `Process steps (5 tool steps)`).

## [1.3.566] - 2026-07-20

### Fixed
- **Rich Markdown Formatting & Table Rendering (`SuperAgentMessageItem.tsx`)**:
  - Implemented a complete Markdown block and inline parser/renderer in `renderMessageContent`. Chat responses now render rich headings (`#`, `##`, `###`), bold/italic formatting, interactive code blocks with copy buttons, indigo inline code badges, blockquotes, list items, divider lines, and styled Markdown tables (`<table>`) with dark glass borders and zebra striping.

## [1.3.565] - 2026-07-20

### Fixed
- **Tool Message Duplication & Premature Block Collapse Bug (`SuperAgentConsoleUtils.ts` & `SuperAgentGroupedMessages.tsx`)**:
  - Fixed an issue where live tool execution created duplicate entries for `tool_start` and `tool_end` events, causing tool counts to jump and vanish upon backend history sync. `tool_end` events now update the matching `tool_start` message in-place with execution results.
  - Ensured all process blocks in an active streaming turn stay expanded during execution without collapsing prematurely.

## [1.3.564] - 2026-07-20

### Fixed
- **Tool Block Ordering & Chronological Stream Layout (`SuperAgentGroupedMessages.tsx`)**:
  - Updated `groupMessagesIntoTurns` to group messages into chronological turn sub-blocks. Initial assistant text (e.g. streaming responses) now renders at the top below the user query, and tool process blocks render below the assistant text in exact chronological order.

## [1.3.563] - 2026-07-20

### Fixed
- **Manual Expansion Persistence Bug (`SuperAgentGroupedMessages.tsx`)**:
  - Fixed an issue where manually expanding the process steps block (`CollapsibleProcessBlock`) while idle caused `useEffect` to trigger a re-render collapse. Expansion state transitions are now strictly scoped to active streaming start/finish events, allowing users to expand and collapse process blocks and tool details freely without auto-collapsing.

## [1.3.562] - 2026-07-20

### Fixed
- **Permanent Session Deletion Persistence Bug (`sessionManager.ts`)**:
  - Fixed a bug where deleting chat sessions created with `session_<timestamp>` IDs bypassed calling SuperAgent's HTTP DELETE API (`/api/history/session/:id`). This left the session intact in SuperAgent's SQLite database (`sessions` table) and on disk, causing deleted sessions to reappear upon app/server restart.

## [1.3.561] - 2026-07-20

### Fixed
- **Process Steps Auto-Collapse Timing Bug (`SuperAgentGroupedMessages.tsx`)**:
  - Fixed an issue where the process steps block (`CollapsibleProcessBlock`) did not automatically contract (collapse) upon agent execution completion. It now remains expanded during active streaming tool processing so users can watch live tool steps, and automatically contracts when execution finishes (`isStreaming` transitions from `true` to `false`).

## [1.3.560] - 2026-07-20

### Fixed
- **SuperAgent Session Title & New Chat Display Bug (`sessionManager.ts` & `useSuperAgentSessions.ts`)**:
  - Fixed an issue where raw session IDs (e.g. `sess/1784537657160/6gu4c4`) were rendered in the sidebar for new chat sessions. Raw session ID strings starting with `sess/`, `sess_`, or `session_` are now sanitized and fallback to `'New Chat'`.
  - Fixed `extractCleanUserText` and `getCleanUserText` to strip `<USER_REQUEST>` prompt wrappers instead of marking the prompt as system noise, enabling proper title generation from user queries.

## [1.3.559] - 2026-07-20

### Fixed
- **WebSocket Proactive Init Race Condition (`superAgentBridge.ts`)**:
  - Removed the redundant proactive `initializeSuperAgentSession` call when establishing a WebSocket connection. This prevents a race condition where the proactive call (initializing a default session without ID) concurrently aborted a prompt's chat run sent immediately after opening the connection.

### Added
- **Comprehensive Integration Test Suite (`test_tline_superagent_all_features.js`)**:
  - Added a test script that validates all SuperAgent REST API endpoints and real-time WebSocket chat/SSE streaming against the running t-line backend server with auth bypass token integration.

## [1.3.558] - 2026-07-20

### Fixed
- **New Session ID Persistence Alignment (SuperAgent `PathResolver.ts` & `sessionManager.ts`)**:
  - Fixed a bug where a newly created chat session (using `session_<timestamp>` format) was generated as a random UUID by the backend's `PathResolver.ts` because the directory did not exist on disk yet. We now ensure the custom session ID is directly used to construct the new history directory and file path if it contains no path separators.
  - Added `resume: sessionId` parameter inside `saveWorkspaceSession` API call inside `sessionManager.ts` to ensure that server registration properly aligns with database historical persistence.

## [1.3.557] - 2026-07-20

### Fixed
- **SuperAgent Session Continuation Bug (`superAgentBridge.ts` & SuperAgent `server.ts`)**:
  - Removed the redundant unconditional session initialization call (`initializeSuperAgentSession`) on every prompt in the bridge. Instead, the bridge now directly calls `/api/chat` and lazily re-initializes only if the server returns a "Session not initialized" error, preserving the active `Agent` context.
  - Fixed `initializeSuperAgentSession` to correctly pass the `resume` payload mapping to `sessionId` so the SuperAgent server actually restores/loads the session message history from the database.
  - Optimized the SuperAgent `/api/init` handler to bypass recreating the `Agent` instance if the requested session is already active in that workspace with the same ID and mode, preserving the runtime context, cache, and token progress.

## [1.3.556] - 2026-07-20

### Fixed
- **SSE Stream Auto-Reconnection (`superAgentBridge.ts`)**:
  - Implemented self-healing reconnect loop for local SSE events. If the SuperAgent server crashes, is restarted, or terminates, the SSE stream will automatically schedule reconnection attempts (every 1s/2s) until the server is back online.
- **Robust Hybrid Stream Parser (`SuperAgentConsoleUtils.ts`)**:
  - Fixed a streaming print bug where repeating characters (like `"aa"` or `"111"` at the start of a message) or duplicate words (like `"haha"`) were swallowed due to a raw `.startsWith()` check.
  - Implemented a safer hybrid check: it only treats a chunk as cumulative if the incoming chunk strictly starts with the accumulated text AND its length is strictly greater than the accumulated text length. Otherwise, it is correctly treated as a delta chunk and appended.

## [1.3.555] - 2026-07-20

### Improved
- **Deduplicated Spawn Implementation (`superAgentBridge.ts`)**:
  - Extracted common spawning logic (stdout, stderr, exit handlers, timeouts, and polling) into a shared `spawnSuperAgentProcess` function.
  - Implemented cached bun environment mapping (`getCachedBunEnv()`) to avoid executing `where bun` / `which bun` repeatedly.
  - Added stdout event capture to trigger `onReady` immediately when the server's running marker is found (removing the artificial polling delay when starting fresh).
  - Reset `connectionAttempts = 0` upon successful SSE connection to allow future auto-start attempts if the server goes down and comes back.
  - Registered a process exit listener (`process.on('exit')`) to cleanly kill the spawned SuperAgent server sub-process on backend exit (preventing orphaned processes).

## [1.3.554] - 2026-07-20

### Fixed
- **SuperAgent Double-Spawn Race Condition (`superAgentBridge.ts`)**:
  - Root cause: `isStartingSuperAgent` was set to `true` **inside** the async `.then()` of `pingPort7888()`, not before. During the ~1.5ms window while the ping was in flight, a second concurrent caller (e.g. eager startup + WS connection arriving simultaneously) would also see `isStartingSuperAgent = false`, also call `pingPort7888()`, also get `false`, and also spawn — resulting in two SuperAgent servers competing on port 7888.
  - **Fix**: Set `isStartingSuperAgent = true` **synchronously** (before the async ping) in both `ensureSuperAgentServer()` and `startSuperAgentEager()`. Any second caller immediately sees the flag and queues itself via `pendingStartCallbacks` instead of racing.
  - When the ping returns `true` (server already running), `isStartingSuperAgent` is reset to `false` and `drainPendingCallbacks()` is called so queued callers proceed immediately.

## [1.3.553] - 2026-07-20

### Fixed
- **`bun.cmd` Also Not Recognized — Bun PATH Not Inherited by Spawn (`superAgentBridge.ts`)**:
  - Root cause: bun installs to `~/.bun/bin/` which is added to the **user's interactive PATH** but is NOT present in the environment inherited by Node.js child processes spawned by the backend (e.g. when launched as a service or via Tauri). So both `bunx.cmd` and `bun.cmd` failed with "not recognized".
  - **Fix**: Added `resolveBunEnv()` helper that:
    1. Tries `where bun` (Windows) / `which bun` (Unix) using the current process PATH.
    2. Falls back to checking `~/.bun/bin/bun.exe` directly on disk.
    3. If found via path 2, injects `~/.bun/bin` into the `PATH` of the spawn env so bun can find its own dependencies.
    4. Returns `{ cmd: absolutePath, spawnEnv }` used in all spawn calls.
  - Switched `shell: false` since we now pass an absolute path — avoids CMD/PowerShell wrapper ambiguity entirely.
  - Applied to both `ensureSuperAgentServer()` and `startSuperAgentEager()`.

## [1.3.552] - 2026-07-20

### Fixed
- **`bunx.cmd` Not Recognized on Windows (`superAgentBridge.ts`)**:
  - Root cause: bun on Windows installs as `bun.exe`, not `bunx.cmd`. Spawning `bunx.cmd` failed with "not recognized as an internal or external command".
  - **Fix**: Changed spawn command from `bunx.cmd` / `bunx` to `bun.cmd` / `bun` with `x` prepended as the first argument (`bun x superagent --server`). This is the canonical cross-platform way to run bun packages and doesn't depend on the `bunx` shim being present.
  - Applied in both `ensureSuperAgentServer()` and `startSuperAgentEager()`.

## [1.3.551] - 2026-07-20

### Changed
- **SuperAgent Server Spawned Once at Backend Startup (`superAgentBridge.ts`, `server.ts`)**:
  - Previously the SuperAgent server was spawned lazily — only when the first WebSocket connection arrived and the SSE connection to port 7888 failed. This caused race conditions when multiple workspaces connected simultaneously (each could trigger its own spawn attempt).
  - Added `startSuperAgentEager()` — a WebSocket-independent startup function that uses the same global `autoSuperAgentProcess` / `isStartingSuperAgent` singleton flags. Called immediately in `server.listen()` callback so the server is warming up before any client connects.
  - `cwd` for the eager spawn is `process.cwd()` (the backend's own working directory), not a user workspace path, making it truly workspace-agnostic.
  - Subsequent `ensureSuperAgentServer()` calls from WS handlers will hit `pingPort7888()` → already up → `callback()` immediately, zero spawning.

## [1.3.550] - 2026-07-20

### Fixed
- **SuperAgent Still Waits 20s on Genuine Startup Failure (`superAgentBridge.ts`)**:
  - When `bunx superagent --server` exits with code 1 (genuine failure, e.g. unsupported workspace), the v1.3.549 fix still waited the full 20-second poll timeout before reporting the error because the exit handler no longer called `abortStartup` at all.
  - **Fix**: Added a deferred 2-second ping after process exit. Flow:
    1. Process exits → wait 2 seconds
    2. `pingPort7888()` → if server IS up: do nothing (polling loop will resolve normally)
    3. If server is NOT up: call `abortStartup` immediately with the captured stderr output
  - This correctly handles both scenarios: shell-wrapper-exits-fast (server still comes up) and genuine process crash (fast failure with real error message in ≤ 3 seconds instead of 20).

## [1.3.549] - 2026-07-20

### Fixed
- **SuperAgent "Failed to Start Within 15 Seconds" False Positive (`superAgentBridge.ts`)**:
  - Root cause: on Windows with `shell: true`, Node's `spawn` creates a shell wrapper process (`bunx.cmd`) that **exits almost immediately** after handing off to the real bun/node server. The `exit` event on the child process fired while the server was still booting, which (in v1.3.548) triggered `abortStartup()` — cancelling the polling loop and incorrectly reporting failure even though the server was running fine.
  - Confirmed by running `bunx superagent --server` manually: `🚀 Superagent Extension Server is running at http://localhost:7888` appears successfully; the stderr "ExperimentalWarning: SQLite" is a harmless Node.js warning that PowerShell treats as stderr, not a real error.
  - **Fix**: Removed the `abortStartup` call from the `exit` handler. `pingPort7888()` is now the *sole* readiness signal — the polling loop runs regardless of whether the shell wrapper exits early. `abortStartup` is only called from `pollReady` on timeout or from the `error` event (spawn failure).
  - **Bonus**: Pending callbacks queued during startup are now properly resolved/rejected when polling completes, eliminating the case where a `prompt` action's `ensureSuperAgentServer` Promise would hang forever while a spawn was in flight.

## [1.3.548] - 2026-07-20

### Fixed
- **SuperAgent ECONNREFUSED — Server Not Ready After Auto-Restart (`superAgentBridge.ts`)**:
  - Root cause: after an ECONNREFUSED triggered an auto-restart of the SuperAgent server, the bridge waited a fixed 3 seconds then immediately retried `/api/chat`. If the server wasn't yet accepting connections (which is common on slower machines or first-start), a second ECONNREFUSED propagated all the way to the user as "Failed to send prompt: connect ECONNREFUSED 127.0.0.1:7888".
  - **Fix 1 — Polling startup**: Replaced the hard-coded `setTimeout(3000)` in `ensureSuperAgentServer` with a `pingPort7888()` polling loop (every 500 ms, up to 15 s). The callback is only fired once the port actually responds, so downstream callers are guaranteed the server is reachable.
  - **Fix 2 — Validated restart retry**: In the ECONNREFUSED recovery path, `initializeSuperAgentSession` is now awaited and its return value checked before retrying `/api/chat`. If init fails, a clear error is thrown immediately rather than blindly retrying.
  - **Fix 3 — Second ECONNREFUSED surfaced clearly**: If `/api/chat` still fails after restart (e.g. `superagent --server` cannot run in the workspace), the error is caught and re-thrown as a descriptive human-readable message instead of the raw Node.js ECONNREFUSED code.

## [1.3.547] - 2026-07-20

### Fixed
- **Loop Spawn SuperAgent Server Berulang (`superAgentBridge.ts`, `sessionManager.ts`)**:
  - Ditemukan dua bug bersamaan yang menyebabkan SuperAgent server di-spawn berulang kali dan keluar dengan `exit code 1`:
    1. **Dual Spawner**: `sessionManager.ts` yang baru diperbarui juga memiliki `autoStartSuperAgentServer` yang men-spawn server secara paralel dengan `ensureSuperAgentServer` di `superAgentBridge.ts`, menyebabkan dua spawn bersaing memperebutkan port 7888 — spawn kedua langsung exit `EADDRINUSE`.
    2. **Respawn Tanpa Ping**: `ensureSuperAgentServer` langsung spawn server baru tanpa mengecek dulu apakah port 7888 sudah ada yang listen.
  - **Fix**: Hapus total `autoStartSuperAgentServer` dan spawn logic dari `sessionManager.ts` — `sessionManager` kini hanya HTTP client murni, bukan spawner.
  - **Fix**: Tambahkan `pingPort7888()` sebelum spawn di `ensureSuperAgentServer`. Jika port 7888 sudah ada server yang berjalan (dari instance external atau spawn sebelumnya), langsung `callback()` tanpa spawn ulang.

## [1.3.546] - 2026-07-20

### Fixed
- **SuperAgent Server Tidak Lagi Dikill saat Abort (`superAgentBridge.ts`)**:
  - Ditemukan bug kritis: ketika user menekan **Stop/Abort**, kode sebelumnya tidak hanya mengirim `POST /api/abort` ke SuperAgent server tetapi juga langsung **membunuh proses** SuperAgent server (`taskkill /F` di Windows, `SIGKILL` di Unix) dan memanggil `forceKillPort7888()` — menyebabkan server mati total dan harus respawn dari awal untuk request berikutnya.
  - Sekarang action `abort` hanya memanggil endpoint `POST /api/abort` dan membiarkan SuperAgent server tetap hidup di port 7888, sehingga request berikutnya (prompt baru, hapus sesi, dll.) langsung terlayani tanpa jeda respawn.

## [1.3.545] - 2026-07-20

### Fixed
- **100% SuperAgent HTTP Server Auto-Spawn & Resilient Session Deletion (`sessionManager.ts`)**:
  - Removed all direct SQLite database fallback code (`better-sqlite3`) to adhere strictly to the 100% SuperAgent HTTP server architecture.
  - Implemented automatic SuperAgent server auto-spawning (`autoStartSuperAgentServer`) in `sessionManager.ts`. If the SuperAgent HTTP server on port 7888 is offline when a session operation (including `DELETE /api/history/session/:id`) is executed, `sessionManager.ts` automatically spawns `bunx superagent --server` and retries the HTTP request.
  - Expanded API response status checking (`res.success`, `res.ok`, `res.status === 'ok'`, `res.status === 'success'`, `res.deleted`, `res.message`) to support all SuperAgent server response formats cleanly.

## [1.3.544] - 2026-07-20

### Fixed
- **SuperAgent ECONNREFUSED 127.0.0.1:7888 Auto-Recovery & Resilient Reconnection (`superAgentBridge.ts`)**:
  - Registered an `exit` event listener on `autoSuperAgentProcess` to immediately reset process reference when the background `superagent --server` process exits or is killed.
  - Added auto-start verification and `ECONNREFUSED` exception handling in `superAgentBridge.ts` when processing `prompt` messages. If the SuperAgent server process is unreachable or terminated, `superAgentBridge` automatically spawns `superagent --server`, initializes the session, and retries prompt delivery seamlessly.

## [1.3.543] - 2026-07-20

### Fixed
- **Session Chat Deletion Bug & Success/Failure Toast Notifications (`useSuperAgentSessions.ts`, `sessionManager.ts`, `superAgentRoutes.ts`)**:
  - Added success toast (`"Session chat berhasil dihapus"`) and error toast (`"Gagal menghapus session chat"`) on chat session removal using `tline-toast`.
  - Fixed a race condition bug where deleting a session previously caused the deleted session to reappear in the sidebar when real-time WebSocket events (`superagent-sessions-changed`) triggered `syncSessions`.
  - Added `deletedSessionIdsRef` to prevent deleted session IDs from being restored during session synchronization.
  - Made `deleteWorkspaceSession` in `sessionManager.ts` return boolean status to handle draft vs server sessions cleanly.

## [1.3.542] - 2026-07-20

### Fixed
- **Missing RAM Stats Endpoint & Responsive Visibility in Footer (`server.ts`, `Footer.tsx`)**:
  - Added missing `/api/system/stats` GET endpoint in `backend/src/server.ts` to return Node process memory usage (RSS, heapUsed, heapTotal) and OS system memory (total, free, platform).
  - Fixed `useSystemStats` hook silently failing with 404 network error when fetching system stats.
  - Adjusted the responsive Tailwind CSS breakpoint for RAM resource stats badge in `Footer.tsx` from `hidden lg:flex` to `hidden sm:flex`, ensuring RAM usage stays visible even on narrower or half-screen snapped windows.

## [1.3.541] - 2026-07-20

### Optimized
- **Multi-Workspace Daemon Mode Support (`superAgentBridge.ts`)**:
  - Removed `pathChanged` from the process kill/restart condition in `ensureSuperAgentServer`.
  - The `superagent --server` process now runs ONCE as a permanent background daemon serving all workspaces concurrently.
  - Workspace switching in `t-line` is now 100% instant without server restarts, process kills, or connection delays.

## [1.3.540] - 2026-07-20

### Fixed
- **Unsaved "New Chat" Session Reset & Chat Stream Leak Fix (`useSuperAgentSessions.ts`, `SuperAgentConsole.tsx`)**:
  - Fixed a critical bug in `useSuperAgentSessions.ts` where creating a new chat session (`+ New Chat`) was overwritten and reset back to the previous chat session whenever `syncSessions` or `superagent-sessions-changed` was triggered before a prompt was sent.
  - `syncSessions` now preserves local-only unsaved sessions (`localOnly`) and keeps `activeSessionIdRef.current` active without wiping out empty chat messages or jumping back to older history.
  - `handleNewChat` now immediately invokes `apiSaveSession(workspace, newSession, [])` to register new session IDs (`/api/init`) with the backend server upon creation.
  - Wrapped `handleSelectSession` and `handleNewChat` in `SuperAgentConsole.tsx` to set `isAbortedRef.current = true` and clear loading/progress/permission states on session switch, preventing in-flight SSE stream chunks from leaking into newly selected or created chat sessions.

## [1.3.539] - 2026-07-20

### Fixed
- **SuperAgent Process Termination & Abort Event Filtering Fix (`superAgentBridge.ts`, `SuperAgentConsoleUtils.ts`, `SuperAgentConsole.tsx`)**:
  - Fixed a critical bug in `SuperAgentConsoleUtils.ts` where receiving status messages containing `"aborted"` prematurely reset `isAbortedRef.current = false`. This caused lingering in-flight SSE events (like `thought`, `tool_start`, `content_delta`, and prompts) to re-enable loading spinners and print messages after the user clicked Stop.
  - `isAbortedRef.current` now stays strictly `true` until the user submits a new prompt in `handleSend`.
  - Updated `handleAgentEventPayload` to also ignore `permission_required`, `question_required`, `plan_approval_required`, and `tool_progress` payloads when `isAbortedRef.current` is true.
  - Implemented `forceKillPort7888()` fallback in `superAgentBridge.ts` to inspect and terminate any active process listening on port 7888 during abort, guaranteeing that background LLM generations, CLI server processes, and subagent tools stop completely even if `autoSuperAgentProcess` is detached or null.
  - Updated `handleAbort()` in `SuperAgentConsole.tsx` to automatically mark any active subagents in `subagentList` as `'CANCELLED'`.

## [1.3.538] - 2026-07-20

### Fixed
- **Backend crash: double-response in `/api/superagent/instances` (`superAgentRoutes.ts`)**:
  - When the upstream SuperAgent server at `127.0.0.1:7888` was unreachable or timed out, `request.destroy()` triggered both the `timeout` and `error` handlers sequentially, each calling `res.json()`. The second call threw `"Cannot set headers after they are sent to the client"`, crashing the entire backend process.
  - Added a `responded` guard flag via `safeSend()` wrapper so only the first handler actually sends the response; subsequent calls are silently ignored.
- **Server errors not propagated to chat UI (`superAgentBridge.ts`, `SuperAgentConsoleUtils.ts`)**:
  - `sendSuperAgentRequest` now detects HTTP non-2xx status codes and HTML error pages instead of silently resolving with `{ raw: body }`.
  - Chat prompt handler now sends `chat_response` with `success: false` when the SuperAgent response contains errors, instead of always reporting `success: true`.
  - Frontend `handleAgentEventPayload` now handles `success === false`, `result.raw`, and `result.message` error variants — previously only `result.error` was checked, causing the loading spinner to spin indefinitely on server errors.
  - Status messages containing "failed" or "error" keywords now also stop the loading state.
  - Unknown payload types are now logged with `console.warn` instead of being silently dropped.

### Added
- **Process-level crash protection (`server.ts`)**: Added `uncaughtException` and `unhandledRejection` handlers as a safety net. These log the error but keep the backend process alive, preventing future unhandled errors from taking down the server.

## [1.3.537] - 2026-07-20

### Refactored (Breaking)
- **100% SuperAgent HTTP Server Migration (`sessionManager.ts`, `superAgentRoutes.ts`)**:
  - Completely removed `better-sqlite3` and all direct SQLite DB access from `sessionManager.ts`. Zero dependency on `~/.superagent-r/history.db` file.
  - All session operations (`getWorkspaceSessions`, `getSessionMessages`, `saveWorkspaceSession`, `deleteWorkspaceSession`) now route 100% through SuperAgent HTTP server at `http://127.0.0.1:7888`.
  - Input history (`getInputHistory`, `saveInputHistory`) now routes 100% through SuperAgent HTTP server (`GET/POST /api/input-history`), no more in-memory or file-based fallback.
  - Removed redundant `fetchSessionsFromSuperAgentServer` helper from `superAgentRoutes.ts` (logic consolidated into `sessionManager.ts`).
  - All Express route handlers in `superAgentRoutes.ts` and `superAgentBridge.ts` updated to `async` to support the new Promise-based API.

### Added (SuperAgent Server)
- **New API endpoints in SuperAgent server (`superagent/src/server.ts`)**:
  - `DELETE /api/history/session/:id` — Delete a session by ID from SuperAgent's history DB.
  - `GET /api/input-history` — Fetch workspace-scoped input/prompt history from DB.
  - `POST /api/input-history` — Save a new input/prompt entry to workspace-scoped history DB.

## [1.3.536] - 2026-07-20

### Cleaned & Refactored
- **Database Safety & SuperAgent Decoupling (`sessionManager.ts`)**:
  - Updated `sessionManager.ts` to open SQLite `history.db` safely in read-only mode (`readonly: true`) for fallback reads, eliminating process file locking conflicts with SuperAgent server.
  - Added safe null-checking across all session query handlers (`getWorkspaceSessions`, `getSessionMessages`, `getInputHistory`, `saveInputHistory`).
  - Fully decoupled `t-line` backend from writing directly into SuperAgent's internal SQLite database, allowing SuperAgent server to manage its own database lifecycle without lock contention.

## [1.3.535] - 2026-07-20

### Fixed & Enhanced
- **SuperAgent Direct Server Session Fetching (`superAgentRoutes.ts`)**:
  - Updated `/api/superagent/sessions` endpoint in [superAgentRoutes.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/superAgentRoutes.ts) to query history sessions directly from SuperAgent HTTP server (`http://127.0.0.1:7888/api/history/sessions`).
  - Added `fetchSessionsFromSuperAgentServer` helper with automated noise filtering (`[Emergency...]`, `[RMemory]`, `[SYS]`, etc.) and title deduplication.
  - Retained graceful SQLite database fallback (`getWorkspaceSessions`) when SuperAgent server is offline or restarting.

## [1.3.534] - 2026-07-20

### Fixed
- **Session Deduplication Sub-String Matching (`sessionManager.ts`)**:
  - Enhanced `cleanDuplicateWorkspaceSessions` and `saveWorkspaceSession` in [sessionManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/sessionManager.ts) to detect overlapping title sub-strings (e.g. `hai` vs `hai ➔ spawn sub agent...`).
  - Merges duplicate GUI draft sessions (`session_...`) with CLI sessions (`D__...`) created within a 10-minute window, preventing single chat conversations from splitting into two separate sidebar entries.

## [1.3.533] - 2026-07-20

### Fixed & Added
- **Delete Confirmation & Session Purge (`SuperAgentHistorySidebar.tsx`, `sessionManager.ts`)**:
  - Added inline confirmation buttons ("Hapus chat?" -> `Hapus` / `Batal`) when clicking the delete icon in [SuperAgentHistorySidebar.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentHistorySidebar.tsx) to prevent accidental deletions.
  - Fixed backend session deletion logic in [sessionManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/sessionManager.ts) to explicitly purge all session messages and session records inside a database transaction.

## [1.3.532] - 2026-07-20

### Fixed & Enhanced
- **Filtered Injected Emergency Summary Noise & Session Title Deduplication (`sessionManager.ts`, `useSuperAgentSessions.ts`)**:
  - Filtered out `[Emergency Summary...]`, `[Emergency Context...]`, `[Context...]`, `[SYS]`, and other injected system noise from session title generation and chat message rendering.
  - Enhanced `cleanDuplicateWorkspaceSessions` in `sessionManager.ts` to purge duplicate CLI and GUI session records in SQLite database that shared matching titles or close timestamps.
  - Resolved session history sidebar clutter and restored clean chat title display (`First Msg ➔ Last Msg`).

## [1.3.531] - 2026-07-20

### Fixed & Enhanced
- **SuperAgent `/api/init` Session ID Handshake (`superAgentBridge.ts`)**:
  - Extended `initializeSuperAgentSession` in `superAgentBridge.ts` to forward `sessionId` during `/api/init` requests.
  - Ensures SuperAgent CLI server immediately binds its active session Map to the GUI's selected session ID upon initialization, closing any remaining session alignment gaps.

## [1.3.530] - 2026-07-20

### Added & Integrated
- **SuperAgent Explicit `sessionId` Integration (`SuperAgentConsole.tsx`, `superAgentBridge.ts`)**:
  - Integrated full support for SuperAgent CLI's new `sessionId` parameter handling in `/api/chat` and WebSocket payloads.
  - `SuperAgentConsole.tsx` now passes `activeSessionId` directly in WebSocket prompt payloads.
  - `superAgentBridge.ts` forwards `sessionId` to SuperAgent server `/api/chat` endpoint, guaranteeing 100% session alignment between GUI and SuperAgent engine.

## [1.3.529] - 2026-07-20

### Fixed
- **SuperAgent Duplicate Session History Bug (`sessionManager.ts`, `useSuperAgentSessions.ts`)**:
  - Implemented `cleanDuplicateWorkspaceSessions` helper in `sessionManager.ts` to automatically detect and purge redundant `session_<timestamp>` entries created alongside CLI `D__...` sessions for the same workspace.
  - Updated `saveWorkspaceSession` to match existing CLI `D__...` sessions for the same prompt/workspace, preventing insertion of parallel session records into SQLite `history.db`.
  - Updated `handleNewChat` in `useSuperAgentSessions.ts` to defer backend API session persistence until a message is actually sent, eliminating empty draft sessions.
  - Guarantees clean, single-session history sidebar entries without duplicate chats when sending messages.

## [1.3.528] - 2026-07-20

### Fixed
- **Strict Session Isolation & Switching Bug (`useSuperAgentSessions.ts`)**:
  - Added `loadedSessionIdRef` guard to prevent race conditions during chat session switching
  - Fixes an issue where switching sessions previously caused the current message state to overwrite target session messages in local storage and SQLite
  - Chat sessions are now 100% isolated, preserving independent chat history and titles when switching between sessions

## [1.3.527] - 2026-07-20

### Added & Redesigned
- **Collapsible Process & Tool Execution Blocks (`SuperAgentGroupedMessages.tsx`)**:
  - Automatically groups intermediate `thought` and `tool` steps for each turn into a clean collapsible block (`> Process steps (N thoughts • M tool steps)`)
  - Automatically contracts intermediate steps upon task completion, keeping the final `assistant` response prominent and clean
  - Live active turn auto-expands while streaming so users can monitor real-time execution steps, and contracts smoothly once finished

## [1.3.526] - 2026-07-20

### Fixed
- **Smart Parameter & Action Extraction for All Tool Types (`SuperAgentToolItem.tsx`)**:
  - Updated `getToolDetails` to extract and display primary action parameters for `manage_plan`, `manage_task`, `schedule`, `ask_question`, `ask_permission`, `generate_image`, `read_url`, `subagent`, etc.
  - Eliminated generic uninformative fallbacks (`Tool manage_plan`), replacing them with clear action descriptions (e.g. `Manage Plan status`, `Manage Task kill (task-123)`, `Schedule 15s: Check build`)

## [1.3.525] - 2026-07-20

### Improved
- **Inline Tool Item Chevron Indicator (`SuperAgentToolItem.tsx`)**:
  - Placed the chevron arrow indicator (`ChevronRight` / `ChevronDown`) directly inline following the target text (`[icon] Action Target >`)
  - Removed far-right positioning (`ml-auto`), keeping tool item headers compact and naturally grouped together

## [1.3.524] - 2026-07-20

### Improved
- **Moved Chevron Arrow Indicator to Right End (`SuperAgentToolItem.tsx`)**:
  - Moved the expand/collapse chevron arrow (`ChevronRight` / `ChevronDown`) to the right end (`ml-auto`) of the tool item header line
  - Keeps tool action (`Read`, `Ran`, `Edited`) and target filename clean and aligned at the beginning of the line

## [1.3.523] - 2026-07-20

### Redesigned & Simplified
- **Ultra-Compact 1-Line Tool Usage Entries (`SuperAgentToolItem.tsx`)**:
  - Simplified tool usage rendering into clean, single-line log items (e.g. `> [icon] Read filename.ts:L1-50`, `> [icon] Ran git commit...`)
  - Reduced vertical height and visual clutter in chat console
  - Retained expandable details panel with left accent border (`border-l border-zinc-800`) for inspecting tool arguments and outputs on demand

## [1.3.522] - 2026-07-20

### Redesigned
- **Borderless & Backgroundless Tool Usage Items (`SuperAgentToolItem.tsx`)**:
  - Removed container background styles (`bg-[#0d101a]`, `bg-[#060810]`, `bg-[#090c14]`) and borders
  - Replaced card box borders with a subtle hover background (`hover:bg-zinc-800/30`) and transparent panel layout
  - Clean left accent border (`border-l-2 border-zinc-800/80`) for expanded tool arguments and execution output

## [1.3.521] - 2026-07-20

### Added & Redesigned
- **Borderless & Backgroundless Chat Message Styling**:
  - Removed message box backgrounds (`bg-transparent`) and borders (`border-none`) from `SuperAgentMessageItem.tsx`
  - Replaced heavy card borders with a clean, modern, borderless layout with colored role header labels (`User`, `Assistant`, `Thought`)
  - Significantly improves readability and eliminates visual clutter in the chat console

## [1.3.520] - 2026-07-20

### Fixed
- **Filtered RMemory & System Prompt Context from Console & Session Titles**:
  - Updated `isSystemNoiseMsg` in `useSuperAgentSessions.ts` to filter out injected memory context headers (`[RMemory`, `[TencentDB`, `<relevant-memories>`, `Agent Memory Context`, `[SYS]`)
  - Memory context headers are no longer rendered as regular chat bubbles in the console UI
  - Updated `generateSessionTitle` (frontend) and `formatSessionTitleFromDb` (backend) to ignore memory context prompts when extracting `First Chat ➔ Last Chat` titles

## [1.3.519] - 2026-07-20

### Fixed & Improved
- **Backend-side Immediate Session Title Generation**:
  - Implemented `formatSessionTitleFromDb` in `backend/src/sessionManager.ts`
  - Session titles are now formatted as `First Chat ➔ Last Chat` directly in the backend when sessions are loaded
  - All chat sessions in the sidebar immediately display their formatted names upon opening the app without needing to click on each session first

## [1.3.518] - 2026-07-20

### Fixed
- **Fully Fixed Session Ordering Stability**:
  - Changed SQLite query in `getWorkspaceSessions` to `ORDER BY created_at DESC` instead of `last_modified DESC`
  - Prevents backend auto-save operations from updating `last_modified` and triggering server-side re-sorting
  - Chat session positions in the sidebar are now 100% fixed and stable by creation timestamp, ensuring selecting/viewing a session never shifts its order

## [1.3.517] - 2026-07-20

### Fixed
- **Stable Chat Session Sidebar Ordering**:
  - Removed automatic session re-sorting (`updated.sort`) when selecting or viewing a session
  - Selecting/viewing a chat session no longer jumps the active session to the top of the sidebar list
  - Session list maintains a fixed, stable order matching the database sequence

## [1.3.516] - 2026-07-20

### Added & Improved
- **First Chat ➔ Last Chat Session Title Formatting**:
  - Implemented `generateSessionTitle(messages)` in `useSuperAgentSessions.ts`
  - Chat session titles are now automatically formatted as `First Chat ➔ Last Chat` (e.g. `hai ➔ chat nya juga di buat...`)
  - Ensures session titles in the history sidebar dynamically reflect both the initial prompt and the latest topic of discussion

## [1.3.515] - 2026-07-20

### Added & Optimized
- **SuperAgent Chat Session Sidebar Infinite Scroll**:
  - Backend `getWorkspaceSessions` now supports `limit`/`offset` query params, returning `{ sessions, totalCount, hasMore }`
  - Sidebar initially loads 30 most recent chat sessions for ultra-fast sidebar rendering
  - Automatically loads next batch of older chat sessions when scrolling down the history sidebar
  - Added "Load more chats..." button and loading indicator at bottom of sidebar list

## [1.3.514] - 2026-07-20

### Added & Optimized
- **SuperAgent Infinite Scroll Pagination**:
  - Backend `getSessionMessages` now supports `limit`/`offset` query params, returning `{ messages, totalCount, hasMore }` for paginated responses
  - Frontend loads only the latest 50 messages on session open, with automatic infinite scroll to load older messages when scrolling to top
  - Added "↑ Load older messages" button as manual fallback, plus a spinning indicator during loading
  - Scroll position is preserved after prepending older messages (no jarring jumps)
  - Drastically reduces initial load time for sessions with hundreds of messages

## [1.3.513] - 2026-07-20

### Refactored
- **SuperAgent Session Manager: JSON → SQLite Migration**:
  - Rewrote `sessionManager.ts` to read/write directly from SuperAgent CLI's SQLite database (`~/.superagent-r/history.db`) using `better-sqlite3`
  - Removed all legacy JSON file-based session storage logic (metadata cache, `history-metadata.json`, per-session JSON files)
  - Sessions now query the `sessions` table with workspace path matching; messages query the `messages` table ordered by `sequence_order`
  - Full message format mapping: `reasoning` → thought bubbles, `tool_calls` JSON → tool invocations, `tool_results` JSON → tool completions
  - GUI session save/delete operations write back to the same SQLite database (UPSERT + transaction-based message replacement)
  - Input history (`getInputHistory`/`saveInputHistory`) now reads from the `input_history` table keyed by `workspace_id`, with file-based fallback
  - `superAgentBridge.ts` history functions delegate to SQLite-based `sessionManager`
  - Added `closeSessionDb()` graceful shutdown handler in `server.ts` for clean DB connection teardown
  - Added `better-sqlite3` and `@types/better-sqlite3` as dependencies

## [1.3.512] - 2026-07-20

### Added & Optimized
- **Optimized Chat History Load Performance**:
  - Implemented memory caching for index files in [sessionManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/sessionManager.ts) (using filesystem modification timestamps to prevent redundant 1MB+ JSON reads/parses).
  - Implemented truncation for large tool execution result streams (slicing strings and stringified JSON exceeding 10,000 characters). This dramatically reduces JSON payload sizes (from 9MB down to less than 50KB) and results in instant, lag-free message history loading.

## [1.3.511] - 2026-07-20

### Added & Enhanced
- **Real-time CLI Chat History Sync Watcher**:
  - Implemented recursive directory watcher for `~/.superagent-r` in [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) to push events (`superagent-sessions-changed`) on session history file writes.
  - Linked global WebSocket manager to [useSuperAgentSessions.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/useSuperAgentSessions.ts) hook on the frontend to automatically refresh chat sessions and message lists in real-time, preserving the user's active session choice during updates.

## [1.3.510] - 2026-07-20

### Added & Fixed
- **Sync Chat Session History with Native CLI Storage**:
  - Updated [sessionManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/sessionManager.ts) to read/write session files and meta records directly under the native CLI storage directory `~/.superagent-r/history/single/` and `~/.superagent-r/history/multi/`.
  - Added full message format mapping between the CLI format (storing messages as `content` with nested `toolCalls` and `toolResults` lists) and the GUI Console interface representation (`text`, `role: 'thought'`, `role: 'tool'`, etc.), ensuring seamless CLI/GUI history synchronization.

## [1.3.509] - 2026-07-20

### Added & Refactored
- **SuperAgent Chat Session History Sync with Disk**:
  - Implemented [sessionManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/sessionManager.ts) to read and persist chat sessions and message histories under `~/.superagent/sessions/<workspaceHash>/`.
  - Added REST API endpoints `GET/POST/DELETE /api/superagent/sessions` for sessions list and message synchronization.
  - Updated [useSuperAgentSessions.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/useSuperAgentSessions.ts) to sync GUI sidebar chat lists and history logs with backend API endpoints, falling back to `localStorage` when offline.
- **Codebase Length Reduction Refactoring**:
  - Refactored [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) by extracting authentication and security connection endpoints into a dedicated router at [authRoutes.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/authRoutes.ts) and all superagent endpoints into [superAgentRoutes.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/superAgentRoutes.ts).
  - Reduced [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) from over 1220 lines to a clean 816 lines (well under the project limit of 1000 lines).

## [1.3.508] - 2026-07-20

### Added & Enhanced
- **SuperAgent CLI History Synchronization**:
  - Implemented `getCliPromptHistory()` and `saveCliPromptHistory()` in [superAgentBridge.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/superAgentBridge.ts) to read and persist prompts into `~/.superagent_history`.
  - Added REST API endpoints `GET /api/superagent/history` and `POST /api/superagent/history` in [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts).
  - Integrated `fetchCliPromptHistory()` in [SuperAgentConsoleUtils.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsoleUtils.ts) and connected it to [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) so Up/Down arrow prompt navigation seamlessly syncs between CLI and GUI.

## [1.3.507] - 2026-07-20

### Fixed & Enhanced
- **SuperAgent System & Error Message Styling & Text Selection**:
  - Made system and error message pills dark-themed (`bg-[#060810]` for standard system messages and `bg-[#0a0507]` with rose borders for errors) in [SuperAgentMessageItem.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentMessageItem.tsx).
  - Enabled full text selection (`select-text`, removing `select-none` and `truncate`) across system messages, user/assistant responses, and tool item outputs in [SuperAgentMessageItem.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentMessageItem.tsx) and [SuperAgentToolItem.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentToolItem.tsx) so users can easily highlight ("block text") and copy error messages and prompt text.

## [1.3.506] - 2026-07-20

### Removed
- **SuperAgent Tab Loading Text Badge**:
  - Removed explicit "Working..." badge from SuperAgent tab header in [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx) for a cleaner tab UI.

## [1.3.505] - 2026-07-20

### Added
- **SuperAgent Management Login & Provider Credentials**:
  - Implemented [SuperAgentLoginManager.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentLoginManager.tsx) for managing LLM provider login profiles and API keys (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, OpenRouter, Groq, Mistral, Azure, Custom REST).
  - Added backend API endpoints `/api/superagent/config/provider` and `/api/superagent/config/active-provider` in [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) and helpers in [presetUtils.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/presetUtils.ts).
- **Model Preset Management**:
  - Created [SuperAgentPresetManager.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentPresetManager.tsx) for viewing model presets, customizing Master & Subagent model roles, and creating custom model presets.
  - Added backend API endpoints `/api/superagent/config/preset` for preset creation, activation, and deletion.
- **Unified SuperAgent Settings Modal**:
  - Built [SuperAgentSettingsModal.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentSettingsModal.tsx) tabbed settings modal (**Management Login**, **Model Presets**, **Execution & Workspace**, **Monitor & Console**).
  - Enhanced [SuperAgentConsoleHeader.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsoleHeader.tsx) and [SuperAgentSettingsMenu.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentSettingsMenu.tsx) with quick action buttons and preset dropdowns.
- **Codebase Modularization**:
  - Created [SuperAgentConsoleUtils.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsoleUtils.ts) to keep [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) well under the strict 1000-line project limit (957 lines).

## [1.3.504] - 2026-07-20

### Fixed
- **Complete Render-Level Hiding of System Connection Noise Pills**:
  - Implemented `isSystemNoiseMsg()` helper in [useSuperAgentSessions.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/useSuperAgentSessions.ts) and applied it to the render filter in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx).
  - Guarantees all WebSocket connection pills ("WebSocket connection established", "SuperAgent WebSocket connection closed", "Connected to SuperAgent server", "SuperAgent ready", "Restarting bridge", etc.) stored in existing `localStorage` sessions or received from state are completely hidden from the chat UI.
  - Cleared default system greeting messages when initializing or switching sessions.

## [1.3.503] - 2026-07-20

### Fixed
- **Filtered Out Connection Noise System Messages from Chat UI**:
  - Filtered out routine WebSocket system connection pills ("WebSocket connection established", "SuperAgent WebSocket connection closed", "Connected to SuperAgent server", "Auto-starting SuperAgent server") from popping up in the chat UI view in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx).
  - All connection events are now logged cleanly to developer `console.log` / `console.info` instead to keep the chat interface clean and clutter-free.

## [1.3.502] - 2026-07-20

### Improved
- **Ultra-Thin Resizer Lines**:
  - Updated sidebar resizer handles in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) to ultra-thin `2px` lines (`w-[2px]`), expanding smoothly to `4px` with indigo glow on hover (`hover:w-[4px] hover:bg-indigo-500/90`).

## [1.3.501] - 2026-07-20

### Fixed
- **Sidebar Drag Resizing Math & Event Overlay**:
  - Updated [useSidebarResize.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/useSidebarResize.ts) to calculate relative offsets using `getBoundingClientRect()` of the main console container (`e.clientX - rect.left` for History, `rect.right - e.clientX` for Monitor).
  - Solved screen position jump bugs when workspace sidebars or split panels are present.
  - Added standalone resizer drag bars (`col-resize`) with glowing hover states and a global drag overlay in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) to prevent iframe/mouse selection traps during active dragging.

## [1.3.500] - 2026-07-20

### Added
- **Resizable Left & Right Sidebars in SuperAgent Console**:
  - Implemented custom mouse drag resizers for both the left Chat History sidebar and right Live Monitor sidebar.
  - Created [useSidebarResize.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/useSidebarResize.ts) hook to handle real-time pixel drag resizing, min/max bounds enforcement, and width persistence in `localStorage`.
  - Updated [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) with interactive resizer bars (`col-resize`) that glow on hover.

## [1.3.499] - 2026-07-20

### Fixed
- **Cleaned Up SuperAgent Header Bar**:
  - Removed awkward left-aligned icon button from the SuperAgent top left header column in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx).
  - Placed neat `History` toggle button in the top right control group alongside `Monitor` and `Setting`.

## [1.3.498] - 2026-07-20

### Improved
- **SuperAgent History Header Icon Controls & Search Dropdown**:
  - Converted **+ New Chat** and **Search** into compact icon action buttons positioned directly in the History sidebar header row next to the title badge.
  - Implemented collapsible search dropdown panel in [SuperAgentHistorySidebar.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentHistorySidebar.tsx) that smoothly toggles open/close upon clicking the search icon button.

## [1.3.497] - 2026-07-20

### Added
- **SuperAgent Left Chat History & New Chat Feature**:
  - Implemented collapsible left history sidebar [SuperAgentHistorySidebar.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentHistorySidebar.tsx) featuring a prominent **+ New Chat** button, real-time title search filter, dynamic title editing/renaming, and session deletion.
  - Added multi-session state hook [useSuperAgentSessions.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/useSuperAgentSessions.ts) with workspace-keyed `localStorage` persistence, automatic session creation, title auto-generation from first user prompt, and backward-compatible migration from legacy single-session storage.
  - Integrated history toggle button (`History` icon) into the header of [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx).

## [1.3.496] - 2026-07-20

### Fixed
- **SuperAgent Chat Abort & Execution Stop Fix**: Resolved an issue where clicking "Stop Agent", clicking "Stop Execution", or running `/abort` did not stop the active chat execution:
  - Added HTTP request timeout handling (2000ms) in [superAgentBridge.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/superAgentBridge.ts) so `/api/abort` calls do not block backend WebSocket processing if the server is non-responsive.
  - Implemented forceful process termination (`taskkill` on Win32 / `SIGKILL` on Unix) for `autoSuperAgentProcess` upon abort, guaranteeing active background LLM generation and subagent tools stop immediately.
  - Added `isAbortedRef` event suppression tracking in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) to prevent lingering SSE stream chunks from turning loading states back on after user cancels.
  - Fixed `/abort` slash command in chat input to immediately trigger `handleAbort()` rather than forwarding `/abort` text as a prompt to the AI model.
- **Strict File Limit Refactoring**: Extracted message rendering into [SuperAgentMessageItem.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentMessageItem.tsx) to maintain `SuperAgentConsole.tsx` strictly under 1000 lines of code.

## [1.3.495] - 2026-07-20

### Added
- **Collapsible Tool Call Summaries**: Implemented clean, expandable tool call rows matching modern IDE agent UI:
  - Created [SuperAgentToolItem.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentToolItem.tsx) component with compact single-line summaries (e.g. `Analyzed App.tsx #L2125-2150`, `Edited SuperAgentConsole.tsx`, `Searched "query"`).
  - Features interactive click-to-expand / collapse (`>` to `v`) to reveal full JSON arguments, execution output/stdout, and a one-click copy button.
  - Integrated [SuperAgentToolItem](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentToolItem.tsx) into [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx#L874-L878) to replace previous bulky tool output boxes.

## [1.3.494] - 2026-07-20

### Added
- **AI Working Indicator on SuperAgent Tab Header**: Added a visual loading indicator to the SuperAgent tab header in [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx#L2133-L2147):
  - Automatically converts the tab icon to a spinning `Loader2` indigo icon when the AI agent is thinking or running tools.
  - Displays a glowing `Working...` pill badge with a pulsing dot next to the tab title so users can instantly monitor AI background activity even while working in other terminal or editor tabs.
  - Updated [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx#L70-L75) with `onLoadingChange` callback to notify parent header of real-time execution status.

## [1.3.493] - 2026-07-20

### Fixed
- **Background Execution & Persistent SuperAgent Component**: Fixed SuperAgent process stopping when switching tabs in [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx#L2326-L2338):
  - Changed tab rendering so `SuperAgentConsole` remains continuously mounted in the DOM (`display: none` when non-active) instead of conditionally unmounting.
  - Keeps the WebSocket connection and SSE listener alive when switching to terminal, file, or diff tabs, enabling AI tasks to run seamlessly in the background without process interruption.

## [1.3.492] - 2026-07-20

### Fixed
- **SuperAgent Chat History Persistence**: Fixed chat history disappearing when switching tabs in [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx):
  - Integrated `localStorage` persistence keyed per workspace (`superagent_messages_<workspace>`) so chat stream, system notifications, tool calls, and assistant responses are automatically preserved.
  - Added workspace change detection to seamlessly load history when switching active project workspaces.
  - Deduplicated WebSocket connection notifications on tab re-activation to prevent cluttering the message log.

## [1.3.491] - 2026-07-20

### Fixed
- **Superagent Preset & Provider Profile Resolution**: Fixed preset application in [presetUtils.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/presetUtils.ts) when switching presets:
  - Validates and resolves `providerProfileId` against configured provider profiles in `model-config.json`.
  - Automatically falls back to the active/configured provider profile if a CLI preset references a non-existent provider profile ID, preventing Superagent from using invalid credential references.
  - Correctly builds structured tier configs (`superagent`, `subagentDefault`, `master`) so preset model settings match the Superagent core expectations.

## [1.3.490] - 2026-07-20

### Removed
- **Redundant SuperAgent Header Bar**: Removed the `SuperAgentConsoleHeader` sub-bar (`Active Workspace`, `CLI Mode`, `Custom CLI Flags`, `Apply & Restart Bridge`) from [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx).
  - All workspace, execution mode, and bridge restart controls have been fully consolidated into the top-right [SuperAgentSettingsMenu.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentSettingsMenu.tsx) popover, maximizing vertical space for the console log.

## [1.3.489] - 2026-07-20

### Added
- **Top-Right Setting Menu**: Added a new `Setting` menu button next to the `Monitor` button in the top right header of the SuperAgent Panel.
  - Created [SuperAgentSettingsMenu.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentSettingsMenu.tsx) popover component providing quick access to CLI Mode switcher, custom flags, bridge restart, live monitor toggles, console output cleaner, and global application settings modal.
  - Integrated [SuperAgentSettingsMenu](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentSettingsMenu.tsx) into [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) and updated [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx) to pass global settings handler.

## [1.3.488] - 2026-07-20

### Fixed
- **Superagent CLI Preset Integration**: Fixed preset sync and loading for Superagent:
  - Created [presetUtils.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/presetUtils.ts) to merge presets stored in `~/.superagent-r/model-presets.json` (saved via Superagent CLI `/model` command) with `model-config.json`.
  - Updated `/api/superagent/config` endpoint in [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) so all CLI presets appear in the frontend preset dropdown switcher.
  - Updated `/api/superagent/config/active-preset` endpoint to parse and apply the selected preset's model parameters and active provider profile to `model-config.json`, ensuring selected CLI presets take effect upon bridge restart.

## [1.3.487] - 2026-07-20

### Fixed
- **Left-Aligned System Message Pills**: Changed status pill alignment for `system` role messages from centered to left-aligned (`justify-start`, `text-left`), creating a consistent vertical alignment along the left edge of the SuperAgent message stream.

## [1.3.486] - 2026-07-20

### Fixed
- **Cleaned Up System Message Cards**: Replaced wide, heavy card container blocks for `system` status messages with sleek, compact centered status pills featuring an status indicator dot. Prevents cluttering the stream and conserves vertical space.

## [1.3.485] - 2026-07-20

### Enhanced
- **Hallmark Anti-AI-Slop SuperAgent Interface Redesign**: Applied Hallmark design principles across all SuperAgent console components (`modern-minimal` genre, `Cobalt` theme, `Workbench` macrostructure):
  - Added CSS design tokens stamp and OKLCH color definitions in [components.css](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/components.css).
  - Polished interactive card UI states ([SuperAgentInteractiveCards.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentInteractiveCards.tsx)) with 8-state button microinteractions, instant focus-visible rings, and high-density dark backdrop filters.
  - Refined [SuperAgentConsoleHeader.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsoleHeader.tsx) and [SuperAgentInputContainer.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentInputContainer.tsx) with token-based borders, high-precision typography, slash command popover styling, and status indicators.
  - Upgraded [SuperAgentAuditLogs.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentAuditLogs.tsx) with real-time log filtering, custom tag badges, and formatted JSON output containers.
  - Recorded project memory in [.hallmark/log.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/.hallmark/log.json).

## [1.3.484] - 2026-07-20

### Enhanced
- **Unified File & Image Attachments**: Merged image and document pickers into a single, compact `Paperclip` trigger button next to the console textarea. The file selection automatically detects file types: images render visual thumbnail previews, while text-based files/documents are read as raw text and automatically appended to the backend prompt.
- **Minimalist Preset & Model Changer**: Added a minimalist selector directly below the input console. Users can select and change model presets, view the main model name, and have the bridge automatically restart to apply changes immediately.
- **Strict File Limit Modularization**: Split and refactored [SuperAgentConsole.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsole.tsx) to remain strictly under the 1000-line constraint (total lines reduced to 903):
  - Extracted workspace configuration header to [SuperAgentConsoleHeader.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentConsoleHeader.tsx).
  - Extracted log list tab to [SuperAgentAuditLogs.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentAuditLogs.tsx).
  - Extracted permission, question, and plan approval cards to [SuperAgentInteractiveCards.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentInteractiveCards.tsx).
  - Extracted slash commands list generator to [SuperAgentCommands.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SuperAgentCommands.ts).

## [1.3.483] - 2026-07-20

### Enhanced
- **SuperAgent Console Input Upgrades**: Replaced the single-line input field with a multi-line, auto-growing textarea supporting dynamic height (up to `240px`) and custom key bindings (`Enter` to send, `Shift+Enter` for newlines).
- **Interactive Slash Commands (`/`)**: Introduced autocomplete drop-up menu triggered strictly by typing `/` in the input (supporting `/help`, `/status`, `/abort`, `/clear`, `/mode`, `/single`, `/multi`, `/resume`, `/workspace`, `/explain`, `/test`, `/reset`) with full keyboard navigation support (`ArrowUp`/`ArrowDown`/`Tab`/`Enter`/`Escape`).
- **Outside Click Handler**: Added automatic closing of the autocomplete suggestions popup when the user clicks outside the console input container.
- **Prompt History Navigation**: Enabled cycling through sent prompts inside the textarea using `ArrowUp`/`ArrowDown` navigation.
- **Input Stats & Helper info**: Displayed character counter and shortcut instruction guide.

## [1.3.482] - 2026-07-19

### Fixed & Enhanced
- **SuperAgent Workspace Auto-Sync**: SuperAgent Console now automatically tracks and syncs with the active workspace selected in t-line (`panelWorkspace`). Added an interactive workspace dropdown selector allowing quick workspace switching.
- **SuperAgent Auto Session Initialization**: Fixed missing session errors (`Session not initialized`) by auto-calling `/api/init` on the SuperAgent server (`127.0.0.1:7888`) before sending chat prompts or establishing SSE listeners.
- **Interactive Agent Capabilities**: Added interactive cards in SuperAgent Console for Tool Permission requests (Allow Once / Allow Session / Deny), Agent Question prompts (Choice buttons & custom text input), and Plan Approval requests (Approve & Execute / Reject).
- **Execution Abort & Stream Progress**: Added a real-time Stop/Abort button to cancel running agent tasks and live stream output indicators for progress events.
- **Modular Backend Architecture**: Refactored SuperAgent server bridge handling into `backend/src/superAgentBridge.ts`, maintaining clean code modularity and respecting file length limits.

## [1.3.481] - 2026-10-24

### Changed
- Bumped workspace packages and project version to 1.3.481.
- Synchronized latest repository modifications and pushed updates.

## [1.3.480] - 2026-10-24

### Changed
- **Migrated package manager to Bun**: Replaced all `npm` runner tasks and commands with `bun`. Removed lockfiles and generated new `bun.lockb` structure.
- **Optimized Scripts**: Configured global workspace targets to utilize bun filtering syntax (`bun run --filter`).

## [1.3.478] - 2026-07-16

### Fixed
- **Terminal Output Lag and Disappearing Content**: Fixed a major bug where terminal output would lag, freeze, or display corrupted/duplicated content. 
  - Removed the `requestAnimationFrame` (RAF) write-batching queue on the frontend ([TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx)) to write PTY data directly to `xterm.js`. This prevents extreme memory-accumulation lag when browser tabs are in the background and resolves out-of-order viewport/scrollback redraws when refocusing/reconnecting.
  - Increased xterm.js scrollback buffer configuration from `1000` to `10000` lines so that older logs are not prematurely deleted from the scrollback history buffer.
  - Added an automatic fallback to `CanvasAddon` when the `WebglAddon` triggers a context loss event (`onContextLoss`), preventing blank or frozen terminal screens.
- **Backend Replay Buffer Limit**: Increased the maximum rolling output replay buffer size (`OUTPUT_BUFFER_MAX_BYTES`) in [terminalManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/terminalManager.ts) from `32KB` to `256KB` to support longer scrollback recovery on session re-attach / tab refresh.

## [1.3.477] - 2026-07-16

### Fixed
- **Terminal Initial Command Log Spam**: Stopped console log spam during terminal instance initialization when no `initialCommand` is provided (which is the case for most normal terminals). The `useTerminalInitialCommand` hook ([useTerminalInitialCommand.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminalInitialCommand.ts)) now returns early immediately if `initialCommand` is empty or undefined, avoiding unnecessary "Hook triggered" and "Skipping command execution" log spams.

## [1.3.476] - 2026-07-16

### Added
- **Terminal Grid Inline Copy & Run Actions**: Added inline action buttons (Copy and Run) to the header of terminal cards in the Grid Monitor tab ([TerminalGridTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalGridTab.tsx)). Hovering over a card reveals two new buttons next to the title:
  - **Copy**: Copies the terminal name/command (`displayName`) to the clipboard with an interactive visual checkmark micro-animation.
  - **Run**: Sends the command directly to the terminal shell to execute it.

### Refactored
- **TerminalGridTab Code Length Optimization**: Extracted all CSS rules (546 lines of CSS) out of [TerminalGridTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalGridTab.tsx) into a new dedicated stylesheet [TerminalGrid.css](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/TerminalGrid.css) imported via [index.css](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/index.css). This reduces the size of `TerminalGridTab.tsx` from 1164 lines down to ~620 lines, fully satisfying the strict 1000-line project length limit.

## [1.3.475] - 2026-07-16

### Fixed
- **Virtual Touch Keyboard Popup on Desktop**: Fixed a bug where focusing the terminal on touch-screen desktop computers (like ASUS laptops) or small window sizes (width <= 768px) automatically popped up the virtual touch keyboard (`MobileKeyboard`). Refined the `isMobileDevice` detection utility in [TerminalHelpers.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalHelpers.ts) to strictly match mobile operating systems and iPad Safari browsers, excluding desktop platforms.

## [1.3.474] - 2026-07-16

### Improved
- **Graceful Network Offline & Change Handling**: Centralized fetch/network error handling to prevent console log spam with red `net::ERR_NETWORK_CHANGED` or offline `TypeError: Failed to fetch` stack traces during connection switches or drops. Added [network.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/utils/network.ts) utility to identify offline/network-change failures and log them as soft warnings instead of red error stack traces in all background polling hooks (`useTunnel`, `useSystemStats`, `useGitStatus`, `useWorkspaces`, `useUpdateChecker`, and `useAuth`).

## [1.3.473] - 2026-07-16

### Fixed
- **xterm WebGL Addon Undefined 'loadCell' Crash**: Fixed a crash (`TypeError: Cannot read properties of undefined (reading 'loadCell')`) in `WebglRenderer._updateModel` when the terminal buffer is temporarily reset (e.g. during a scrollback history replay). Monkey-patched `WebglRenderer._updateModel` in [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) to check if the requested row buffer lines are populated before updating the rendering model, returning early if they are not yet available.

### Refactored
- **TerminalInstance Code Length Optimization**: Moved `FILE_PATH_REGEX` and `registerFileLinkProvider` into [TerminalHelpers.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalHelpers.ts) to reduce the size of [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) below the strict 1000-line project limit (bringing it down to 995 lines).

## [1.3.472] - 2026-07-15


### Fixed
- **Preview Proxy: `Origin header is not a valid URL` / 500 errors**: Fixed a bug where invalid `Origin` headers sent by the Tauri WebView (e.g. `null`, `tauri://localhost`) were being forwarded verbatim to the target dev server via the preview proxy. Target dev-servers (Vite, webpack-dev-server, etc.) run their own `cors` middleware which throws `"Origin header is not a valid URL"` on non-HTTP origins, crashing the proxied request and returning a 500 back to the browser. The fix strips any non-HTTP/HTTPS `Origin` header in the `proxyReq` event handler in [previewProxy.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/previewProxy.ts) before the outbound request is forwarded.

## [1.3.471] - 2026-07-15

### Improved
- **Process Memory Stats Algorithm Optimization**: Redesigned the process tree query algorithm in the Tauri memory command. Instead of doing independent upward parent-chain traversals for all 300+ system processes, the algorithm now builds a single-pass parent-to-children tree and performs a Depth-First Search (DFS) starting from the main application PID, pruning at the backend PID. This reduces time complexity from $O(N \cdot H)$ to $O(M)$ where $M$ is the number of application descendants ($M \ll N$).

## [1.3.470] - 2026-07-15

### Improved
- **Process Memory Stats Query Optimization**: Optimized memory usage stats polling in the Tauri application. Cached the `sysinfo::System` instance in `DesktopState` to avoid expensive system re-allocations on every poll (every 5 seconds) and enable sysinfo's native Windows process delta updates. Consolidated parent-child traversal logic into a single combined check (`get_descendant_status`), halving the required process tree traversals for every system process.

## [1.3.469] - 2026-07-15

### Fixed
- **Tauri Main Thread Hang (Application Not Responding)**: Fixed a critical app hang bug (reported as Event ID 1002, "Top level window is idle" in Event Viewer) that caused `t-line.exe` to lock up when polling memory stats. Refactored `is_descendant_of` in [lib.rs](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/src/lib.rs) to use loop-cycle detection with a `HashSet` and filter out PID 0 (System Idle Process), preventing infinite traversal loops when checking system process trees.

## [1.3.468] - 2026-07-15

### Improved
- **Browser Address Bar Retrigger/Reload**: Updated URL navigation and bookmark handlers in [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) to detect when navigating to the currently active URL. If it matches, the tab now automatically triggers a reload (`handleReload`), allowing users to refresh the page by pressing Enter in the address bar.

## [1.3.467] - 2026-07-15

### Improved
- **Smooth Browser Navigation**: Refactored the native webview lifecycle in [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) to prevent destroying and recreating the Tauri native Webview overlay when navigating or changing URLs. Instead, the existing Webview is navigated programmatically, which completely eliminates white loading flashes.
- **Flashing Mitigation via Dark Theme Background**: Replaced hardcoded `bg-white` classes with `bg-[var(--bg-main)]` on all webview and iframe viewport wrappers to ensure a smooth background transition matching the active workspace theme.

## [1.3.466] - 2026-07-15

### Added
- **Browser Blank Link Interception**: Clicking on `target="_blank"` anchors or calling `window.open` within the embedded browser will now automatically open a new browser tab inside the **t-line** workspace manager instead of launching them in the default system browser or failing to navigate. Works across Tauri, Electron, and standard web browser (proxied iframe) environments.

### Refactored
- **Browser Tab Code Optimization**: Moved the inline native webview polling Javascript generator from [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) to [browserUrlUtils.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/browserUrlUtils.ts). This keeps [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) strictly under the 1000-line repository limit (reduced to 948 lines).

## [1.3.465] - 2026-07-15

### Added
- **Automatic 401 Unauthorized Session Recovery**: Introduced a global fetch interceptor in `useAuth` to catch 401 Unauthorized HTTP errors. If running inside Tauri, the client retrieves the new bypass token, updates local storage, resets the WebSocket manager, and transparently retries the failed API request.
- **WebSocket Lifecycle Management**: Added `disconnect` and `reconnect` methods to `TerminalWebSocketManager` to handle token changes gracefully and avoid infinite connection attempt loops.

## [1.3.464] - 2026-07-15

### Improved
- **Split Pane Close Icon Replacement**: Replaced the default cross (X) close icon on split panes with the `Trash2` trash bin icon (for both desktop action bar and mobile viewport action popover) as requested for clearer semantic deletion feedback.

## [1.3.463] - 2026-07-15

### Added
- **Tab Drag → Terminal Viewport Splits (IDE-style)**: You can now drag a terminal tab header directly onto any terminal screen viewport (the main workspace window). Depending on which quadrant the cursor is dropped on (left/right/top/bottom), the target terminal pane will split horizontally or vertically.
- **Visual Split Overlays**: Terminal panes now render a semi-transparent dashed purple overlay to preview where the dragged terminal will split.

## [1.3.462] - 2026-07-15

### Fixed
- **Grid Tab Leak Across Workspaces**: Grid tabs (type === 'grid') were previously displayed in all workspace views regardless of which workspace context they belonged to. Now, they are filtered dynamically and only rendered in the workspace/project context where their corresponding terminal instances belong (or if their explicit `workspaceId` matches).

## [1.3.461] - 2026-07-15

### Added
- **Tab Drag → Terminal Split Pane**: Dragging a terminal tab onto the edge (left/right/top/bottom quarter) of another terminal tab now merges both into a split-pane layout (SplitLayoutNode) instead of reordering. Dropping in the center still reorders.
- **Tab Drag → Grid Tab**: Dragging a terminal tab onto a grid tab now adds all terminal IDs from the dragged tab into the target grid's `gridTerminalIds`, then switches focus to the grid. The dragged tab is removed.

### Improved
- **5-Zone Drop Detection for Terminals**: When dragging a terminal over another terminal, the cursor position is divided into 5 zones (left 25% / right 25% / top 35% / bottom 35% / center). Each zone triggers a distinct visual indicator and drop action.
- **CSS indicators `drag-over-top` / `drag-over-bottom` / `drag-over-center`** now also fire during mouse-based drag (previously only used in HTML5 DnD path).

## [1.3.460] - 2026-07-15

### Fixed
- **Tab Drag & Drop Stale Closure Bug**: `draggingTabId` was captured via stale closure in `handleTabDragOver` — the first `dragover` event fired before React state updated, causing early bail-out. Fixed by adding a `useRef` alongside the state so handlers always read the latest value synchronously.
- **Tab Drag-End Cleanup**: `handleTabDragEnd` no longer relies on `e.currentTarget` to remove the `dragging` class (DOM manipulation was redundant since React controls the class via state). Cleaned up to only reset state/ref.

### Improved
- **Tab Reorder Logic — Swap → Insert**: Dropping a tab onto another now uses insert-before/after semantics instead of position-swap. This gives correct ordering when dragging across multiple positions (e.g. dragging tab A past tabs B and C now places A correctly, not just swapping A with C).
- **Tab Drag Insertion Indicator**: Non-terminal tab drag-over now shows a glowing left/right edge line (instead of a generic center-highlight) to clearly show where the tab will be inserted.
- **Cursor Feedback**: Tabs now show `cursor: grab` on hover and `cursor: grabbing` while being dragged, making the drag affordance immediately discoverable.
- **Dragging Visual**: The tab being dragged now slightly shrinks (`scale(0.96)`) with a purple dashed border and glow shadow for a polished "lifted" feel.
- **Insertion Line Animation**: The drop-target indicator line pulses with a subtle keyframe animation for better visibility.

## [1.3.459] - 2026-07-15

### Added
- **Confirm Modal for Bookmark Deletion**: Clicking the trash icon on a bookmark now shows an inline confirm dialog with the bookmark name before deleting.
- **Confirm Modal for Clear All**: Clicking "Clear All" now shows an inline confirm dialog showing how many bookmarks will be removed before proceeding.

## [1.3.458] - 2026-07-15

### Fixed
- **Bookmarks Dropdown Stacking Context & Background Color Fix**:
  - Added `relative z-50` to the Top Navbar container in `BrowserTab.tsx` to establish a stacking context. This ensures that absolute-positioned dropdowns float on top of the sibling relative viewport container instead of rendering behind/underneath it.
  - Replaced the opacity modifier `bg-[var(--bg-card)]/95` in `BookmarksDropdown.tsx` with standard `bg-[var(--bg-card)]`. Since opacity modifiers do not resolve correctly with CSS variables containing hex color values, this fix restores the opaque background to the dropdown and prevents it from rendering transparently.

## [1.3.457] - 2026-07-15

### Fixed
- **Tauri Native Webview Overlap on Bookmarks Dropdown**:
  - Automatically hide the OS-level Tauri native webview overlay when the Bookmarks dropdown is open (`showBookmarksDropdown = true`).
  - This prevents the native webview overlay from drawing over the HTML dropdown list.
  - Hiding the native webview also restores click event registration on the main page wrapper, ensuring that clicking outside the dropdown correctly triggers the `handleClickOutside` listener to dismiss it.

## [1.3.456] - 2026-07-15

### Changed
- **Browser Preview UI Relayout**:
  - Re-organized the browser preview top toolbar into a highly polished, clean 3-section layout.
  - Grouped navigation buttons (Back, Forward, Reload) into a unified glassmorphic container on the left.
  - Elongated the URL input bar in the center with a purple Globe icon and rounded-full borders.
  - Integrated the Bookmark Star toggle and Bookmarks folder trigger directly inside the right of the URL bar container.
  - Simplified Zoom controls and Device View mode selectors into compact, pill-shaped groups on the right.
  - Replaced text buttons like "Inspect" and "Open Browser" with clean, space-saving icon buttons.
  - Extracted the Bookmarks list dropdown logic into a separate `BookmarksDropdown` component.
  - Refactored `BrowserTab.tsx` to combine duplicate useEffect hooks, bringing its total line count strictly below the 1000 lines limit.

## [1.3.455] - 2026-07-15

### Added
- **Browser Preview: Zoom Controls & URL Bookmarking**:
  - Added new zoom in, zoom out, and zoom reset controls (Minus/Plus buttons) to the browser toolbar.
  - Implemented native/CSS zoom for iframe, Electron webview, and Tauri native webview.
  - Added a bookmark Star icon in the URL bar to bookmark pages, and a folder dropdown menu to manage and visit saved URLs/domains.

## [1.3.454] - 2026-07-15

### Fixed
- **Cursor/Caret Visibility with CLI AI Agents**:
  - Replaced the narrow check for `isSuperagentRunning` with a broader `isAiAgentRunning` check, which covers all CLI AI agents (`isClaude`, `isGemini`, `isSuperagent`, `isAgy`, `isOpenCode`).
  - Hides the terminal emulator's cursor when any of these agents are running to prevent duplicate carets (one at the input line, and another block cursor in the status line at the bottom right).

## [1.3.453] - 2026-07-15

### Fixed
- **Smart Paste Confirm Dialog Event Interception & Key Handling**:
  - Stopped event propagation of `mousedown`, `mouseup`, `click`, and touch events inside the smart paste confirmation modal to prevent the terminal's focus handler from intercepting the clicks and stealing focus.
  - Added native keyboard event listener inside the smart paste modal for confirming with `Enter` and cancelling with `Escape`.
  - Blocked terminal keydown processing in xterm when the smart paste confirmation modal is open to avoid typing behind the modal.

## [1.3.452] - 2026-07-15

### Added
- **Browser Preview: Device Switcher (Mobile, Tablet, Desktop Views)**:
  - Added new toolbar button controls (`Monitor`, `Tablet`, `Smartphone`) to switch between Desktop, Tablet, and Mobile preview dimensions.
  - Sized and rendered a premium device frame bezel layout overlay with shadows, centering, and size/resolution info labels when mobile or tablet view mode is selected.
  - Refactored `BrowserTab.tsx` by extracting raw event listeners to `useBrowserListeners` hook to stay below the strict 1000-line limit per file.

## [1.3.451] - 2026-07-15

### Added
- **Quick Launch: Select Grid Modal (Multi-Grid Support)**:
  - Ditambahkan komponen `SelectGridModal` baru untuk menangani kasus ketika pengguna mengklik item Quick Launch dan terdapat lebih dari satu tab Grid yang sedang aktif.
  - Modal akan menampilkan daftar semua tab Grid yang aktif beserta jumlah terminal di dalamnya, dan memberikan opsi pilihan untuk memasukkan terminal baru ke dalam salah satu grid tersebut, atau membuat tab grid baru.
  - Jika jumlah tab grid aktif adalah 0 atau 1, terminal akan langsung dibuat/ditambahkan secara otomatis tanpa memunculkan modal konfirmasi.

## [1.3.450] - 2026-07-15

### Changed
- **Quick Launch Default Grid vs Regular Terminal Tab**:
  - Mengubah perilaku default: hanya pembukaan terminal via **Quick Launch** yang akan langsung diarahkan masuk ke tab Grid (`forceGrid = true`). 
  - Pembukaan terminal baru biasa (seperti tombol `+` di tab bar) akan tetap membuka terminal tunggal fullscreen (`type: 'terminal'`) secara default (kecuali jika saat itu tab aktifnya memang sudah berupa tab grid).

## [1.3.449] - 2026-07-15

### Added
- **Default Grid Tab Creation**:
  - Mengubah perilaku default saat membuka terminal baru (baik dari pintasan Quick Launch maupun tombol `+` di tab bar).
  - Terminal baru sekarang secara default akan dibuat di dalam Tab Grid (`type: 'grid'`) dengan nama format `Grid (WorkspaceName)` alih-alih sebagai terminal tunggal fullscreen. Ini memudahkan pengelompokan terminal baru langsung ke dalam grid sejak awal.

## [1.3.448] - 2026-07-15

### Added
- **Quick Launch: Launch directly into Active Grid**:
  - Mengubah fungsi `openTerminal` agar mendeteksi jika tab aktif saat ini bertipe `'grid'`.
  - Jika ya, terminal baru yang dibuat akan langsung dimasukkan ke dalam daftar `gridTerminalIds` pada tab grid aktif tersebut daripada membuka tab terminal fullscreen baru. Ini memungkinkan eksekusi pintasan Quick Launch atau pembukaan terminal baru langsung mengisi grid yang sedang dilihat.

## [1.3.447] - 2026-07-15

### Added
- **Drag-to-Split Tab**:
  - Ditambahkan fitur penarikan (*drag*) tab terminal dan menjatuhkannya (*drop*) di atas tab terminal lain untuk menggabungkan panel-panel terminal tersebut ke dalam *split layout*.
  - Mendukung pembagian panel secara **horizontal** (bila tab ditarik ke area 25% sisi kiri/kanan tab tujuan) dan **vertikal** (bila ditarik ke area 35% sisi atas/bawah tab tujuan).
  - Ditambahkan indikator visual interaktif saat melayang (*drag over*) berupa garis ungu menyala di batas panel (kiri, kanan, atas, bawah) atau highlight di tengah tab jika ingin melakukan pengurutan ulang (*swap/reorder*).

## [1.3.446] - 2026-07-15

### Fixed
- **Quick Launch: Gagal Auto-Run Akibat Component Reuse**:
  - Ditemukan dan diperbaiki bug di mana ketika mengklik item Quick Launch baru, command tidak otomatis jalan karena React me-reuse komponen `<TerminalInstance>` dan hook `useTerminalInitialCommand` (karena posisi render yang sama tanpa prop `key` yang unik).
  - Akibat dari component/hook reuse ini, referensi status `initialCommandSent.current` tetap bernilai `true` dari sesi terminal sebelumnya, sehingga memblokir eksekusi perintah baru.
  - **Solusi**: 
    1. Ditambahkan pendeteksi perubahan `tabId` di dalam hook `useTerminalInitialCommand.ts` untuk me-reset status `initialCommandSent` kembali ke `false`.
    2. Ditambahkan prop `key={term.id}` pada inisialisasi `<TerminalInstance>` di dalam `SplitLayoutRenderer.tsx` dan `TerminalGridTab.tsx` untuk memastikan React menghancurkan (unmount) dan membuat ulang (remount) komponen terminal baru secara bersih.
  - Menambahkan log konsol terperinci untuk melacak inisialisasi terminal dan status eksekusi command.

## [1.3.445] - 2026-07-15

### Fixed
- **xterm Canvas Renderer: `Cannot read properties of undefined (reading 'loadCell')` uncaught TypeError**:
  - Diperbaiki crash rendering yang terjadi secara intermittent pada `@xterm/addon-canvas` akibat race condition di mana `_charAtlas` (character atlas texture) belum terinisialisasi saat render frame dipanggil oleh `RenderDebouncer`.
  - Error ini bersifat **uncaught** karena terjadi di dalam animation frame callback internal xterm, melewati semua try-catch yang ada di level aplikasi.
  - **Solusi**: Beralih ke `@xterm/addon-webgl` sebagai renderer utama (sudah terdaftar di `package.json` namun sebelumnya tidak digunakan). WebGL lebih stabil dan tidak memiliki masalah uninitialized atlas. Jika WebGL tidak tersedia (mis. headless browser, GPU lama), fallback ke Canvas, kemudian DOM renderer.
  - Ditambahkan `onContextLoss` handler pada `WebglAddon` untuk dispose gracefully saat GPU context hilang (terjadi di beberapa browser saat tab terlalu lama di-background).

## [1.3.444] - 2026-07-15

### Fixed
- **Quick Launch: Multiple Items Running, hanya satu yang tereksekusi**:
  - Ditemukan dan diperbaiki bug kritis di mana semua terminal yang dibuka via Quick Launch hanya menjalankan command dari terminal **terakhir** yang dibuka, sementara terminal lainnya terbuka namun command-nya tidak dieksekusi.
  - **Root cause**: `initialCommand` (perintah yang akan dijalankan otomatis saat terminal pertama kali dibuat) ikut disimpan ke dalam *sync state* server (`/api/sync/state`) dan di dalam `toCanonicalString`. Saat sesi di-restore atau di-reconnect, `terminalInstances` dari server di-apply langsung ke React state **termasuk `initialCommand`** — menyebabkan `useTerminalInitialCommand` terpicu ulang di setiap terminal yang sudah berjalan.
  - **Perbaikan** di `frontend/src/App.tsx`:
    1. **`toCanonicalString`**: `initialCommand` dihapus dari representasi canonical sehingga tidak pernah tersimpan ke server. Field ini bersifat ephemeral dan hanya valid pada saat terminal pertama kali dibuat secara lokal.
    2. **`sync_update` WebSocket listener**: Saat menerima `terminalInstances` dari remote sync, `initialCommand` di-strip dari semua instance sebelum di-set ke React state.
    3. **`fetchSyncState`**: Saat me-restore session dari server pada startup/login, `initialCommand` di-strip dari semua instance untuk mencegah re-eksekusi command.

## [1.3.443] - 2026-07-15

### Optimized
- **Advanced Terminal Performance Improvements**:
  - **Regex Instantiation Optimization**: Moved the file link regex to the global scope in `TerminalInstance.tsx` to prevent redundant object creations and decrease garbage collection pressure on terminal scroll/hover.
  - **Predictive Session Pre-warming**: Configured frontend tab-header hover states to proactively send `prewarm` signals, preloading and caching active process listings (`wmic`/`ps`) and process names on the backend before the user clicks the tab.
  - **Viewport-Only Replay & Lazy-Loading**: Split backend replay streams at safe newline boundaries near the 4KB limit. The client renders the active viewport instantly, and lazy-loads the scrollback history 60ms later, rebuilding the buffer seamlessly.

## [1.3.442] - 2026-07-15

### Optimized
- **PTY Replay Buffer Memory Optimization**:
  - Implemented automatic merging of output buffer chunks on the backend when the buffer array grows beyond 100 entries. This flattens the rolling buffer array, preventing array size explosion and optimizing array shift performance under high-throughput terminal streams.

## [1.3.441] - 2026-07-15

### Optimized
- **Smart Active Process & Title Polling**:
  - Configured active process (`wmic`/`ps`) and process title polling to skip execution for suspended or detached terminal tabs. This keeps idle CPU and disk usage at zero and prevents background child process thrashing when terminal tabs are inactive or hidden.

## [1.3.440] - 2026-07-15

### Optimized
- **Terminal Session Reattachment Latency**:
  - Removed artificial timeouts (`setTimeout` of 100ms and 50ms) on the backend when reattaching existing terminal sessions and spawning new ones. Re-attaching metadata (PID, replay buffer, and status) is now sent immediately in sequence, reducing reattach latency to 0ms.
- **Resource Leak Prevention**:
  - Restored process persistence for suspended tabs while the application is active, preventing background processes (such as `npm run dev`) from being terminated during active tab switching.
  - Schedulers for the 10-minute terminal cleanup timer are only triggered when the entire client WebSocket connection is completely disconnected or closed, preventing orphaned background processes when the user exits the app.
- **Frontend WebSocket Subscription Consolidation**:
  - De-duplicated WebSocket subscription handling by introducing a single `subscribeToSocket` helper in `TerminalInstance.tsx`.
  - Restored high-performance RAF-batched writes (`scheduleWrite`) for resumed terminal sessions, preventing UI lag/freezes and rendering storms.
  - Reduced overall lines of code in `TerminalInstance.tsx`, keeping the file cleanly below the repository's strict 1000-line limit.

## [1.3.439] - 2026-07-15

### Fixed
- **Local Monaco Editor Hosting**:
  - Added `copy-monaco.cjs` script to automate copying Monaco Editor minified assets from `node_modules` (including hoisted workspaces) to `frontend/public/vs/`.
  - Configured `@monaco-editor/react` to load Monaco assets from local `/vs` path rather than external jsDelivr CDN.
  - Ignored the local Monaco assets folder in the root `.gitignore`.
  - Resolved browser tracking prevention blocks of Monaco storage access and enabled offline code-editing.

## [1.3.438] - 2026-07-15

### Fixed
- **Terminal Split Resize Persistence**:
  - Added `firstSize` and `secondSize` optional properties to the `SplitLayoutNode` tree definition.
  - Passed recursive `onLayoutChange` handler down from `App.tsx` through `SplitLayoutRenderer` to capture layout resize adjustments.
  - Used `Math.round(val * 100) / 100` rounding in `normalizeLayout` to keep floating point layout sizes canonical and prevent state-synchronization infinite loops.
  - Restored stored sizes on mount via `<Panel defaultSize={...}>`.

## [1.3.437] - 2026-07-14

### Added
- **GitHub Pages Promotional Landing Page**:
  - Created a modern, premium landing page in the `/docs` directory including `index.html`, `style.css`, and `app.js` with responsive glassmorphism, animations, custom icons, and visual layout specs.
  - Added an interactive CLI/terminal simulator playground in HTML/JS that models `t-line` terminal sessions, git worktree dirty-sorting, and Cloudflare share tunnels with ACL loggers.
  - Added quick-start commands and tabs with copy-to-clipboard utilities.

## [1.3.436] - 2026-07-14

### Fixed
- **Browser Tab URL Persistence**:
  - Implemented the `onUpdateTabUrl` callback on the `<BrowserTab>` component and propagated URL changes from WebSocket (`tline-url-changed`), Tauri, and Electron navigation events back to the parent tabs list.
  - Ensured `activeUrl` in `BrowserTab.tsx`'s local state is kept in sync with in-page navigation so it can be restored on tab reactivation.
  - Refactored `BrowserTab.tsx` by moving `getCleanUrl` and `openInSystemBrowser` helper functions to `browserUrlUtils.ts`, keeping `BrowserTab.tsx` under the strict 1000-line repository limit.

## [1.3.435] - 2026-07-14

### Fixed
- **Terminal Typing Lag & Unresponsiveness (Superagent / TUI)**:
  - Switched the default GPU-accelerated terminal renderer to `@xterm/addon-canvas`, avoiding `@xterm/addon-webgl`'s glyph texture cache memory leaks, WebGL context limits, and sudden context-loss crashes when running active CLI AI agents for a long time.
  - Throttled terminal cursor position updates in the status bar to at most once every `250ms` (using throttle + debounce). This prevents the React component from re-rendering 60 times per second during rapid output, keeping the main thread free for keystrokes.
  - Extracted the initial command execution logic into a dedicated custom hook (`useTerminalInitialCommand.ts`), which modularizes the codebase and reduces `TerminalInstance.tsx` below the repository's 1000-line limit.

## [1.3.434] - 2026-07-14

### Fixed
- **State Synchronization Infinite Loop**: Resolved an infinite loop where `[Sync] Received real-time state update from server` logged repeatedly. Added a `toCanonicalString` serialization function that normalizes client-only flags (like `isDetached`) and alphabetically sorts keys of the `terminalInstances` object. This ensures state comparison is order-independent and structurally stable across WebSocket pushes and HTTP fetches.
- **Graceful Update Checker Network Handling**: Checks `navigator.onLine` before executing update checks, and catches fetch failures during network status changes (`TypeError: Failed to fetch`) cleanly as warnings instead of console errors.

## [1.3.433] - 2026-07-14

### Fixed
- **Windows Active Process Detection with Commas in CommandLine**: Fixed a major bug in the `wmic` CSV parsing function (`parseWmicCsv` in terminalManager.ts) where processes with command line arguments containing commas were completely ignored due to column parsing shifts. Implemented a robust cell-rebuilding logic that slices fixed fields from the left and right, joining everything in between to correctly reconstruct the `CommandLine` field.

## [1.3.432] - 2026-07-14

### Added
- **Browser Loading Progress Bar**: Added a Chrome-style animated linear loading progress bar at the top of the browser viewport. The loading bar animates when a navigation event starts or a page is reloaded, and transitions smoothly to completion when the page has finished loading (or after an optimized delay in native shell environments).
- **Reload Spin Animation**: Added a spin animation to the reload icon button during active page loading.

## [1.3.431] - 2026-07-14

### Fixed
- **Tauri Native Webview Overlay Covering HTML Dropdowns/Modals**: Fixed the issue where the native child WebView2 overlay covers/cuts off React-rendered context menus, dropdowns, and dialog modals. Added an overlay monitoring `useEffect` in `App.tsx` that dispatches a `tline-hide-native-webview` event when any overlay, dropdown, or modal is active, and updated `BrowserTab.tsx` to listen to this event and toggle the native WebView2 overlay's visibility.

## [1.3.430] - 2026-07-14

### Fixed
- **Tab Context Menu Auto-Closing**: Fixed a race condition where right-clicking a tab header (especially noticeable in Tauri environments on browser tabs) caused the context menu to close immediately. Added `stopImmediatePropagation()` to the initiating contextmenu event and deferred registering the window-level close event listeners to the next macro-task queue using `setTimeout`.

## [1.3.429] - 2026-07-14

### Changed
- **Terminal Local File Path Click Handling**: Added a custom `LinkProvider` in `TerminalInstance.tsx` that detects local file paths and line numbers in terminal output (e.g. `src/App.tsx:234`). When clicked, it dispatches a `tline-open-file-path` event, which is handled in `App.tsx` by resolving the relative path against the active terminal's current working directory and opening the file as a file tab inside the `t-line` editor, scroll-focusing Monaco editor to the exact line number.

## [1.3.428] - 2026-07-14

### Changed
- **Terminal Web Link Handling**: Configured the link click handler in xterm.js (`TerminalInstance.tsx` / `WebLinksAddon`) to dispatch a `tline-open-browser-tab` event. This is handled by a listener in `App.tsx` which opens the clicked link inside a new `t-line` browser tab instead of spawning an external system browser window.

## [1.3.427] - 2026-07-14

### Fixed
- **Open Browser Button**: Updated the `openInSystemBrowser` function in `BrowserTab.tsx` to request the Node backend's browser open endpoint (`/api/browser/open`) first. This resolves the issue where the Tauri native command `open_in_browser` did not exist, causing the "Open Browser" button to fail in Tauri environments.

## [1.3.426] - 2026-07-14

### Changed
- **Folder Explorer (Browse Project)**: Renamed the "Up" navigation button to **"Back"** with an `ArrowLeft` icon for clearer UX when browsing directories inside the "Track New Workspace" modal.

## [1.3.425] - 2026-07-14

### Fixed
- **WebView2 High RAM Usage (BrowserTab)**:
  - **Root Cause Analysis**:
    1. In Tauri, `determineRenderMode` always returns `'tauri-native'` regardless of URL, so every browser tab spawns a full OS-level native WebView2 overlay (Chromium GPU/renderer/network processes) — not a simple iframe.
    2. All browser tabs were mounted in the DOM simultaneously; inactive ones were only `hide()`-d but still alive in memory.
    3. A `requestAnimationFrame` loop ran continuously per-tab syncing WebView2 bounds, even when invisible.
  - **Fix — Lazy+Cache Hybrid Strategy**:
    - `App.tsx`: Added `mountedBrowserTabIds` Set state. A `BrowserTab` is **only added to the React DOM the first time its tab becomes active** (lazy mount), preventing unused WebView2 instances from being created upfront. The Set is pruned when tabs are closed.
    - `BrowserTab.tsx`: Added `webviewActive` state. When `isActive` transitions to `false`, the native WebView2 overlay is **destroyed** (`.close()`) immediately to release RAM. When `isActive` becomes `true` again, the WebView2 is **recreated** from the preserved `activeUrl` state.
    - Replaced the previous `show()`/`hide()` visibility approach with this destroy/recreate lifecycle.
    - URL polling (500ms interval) and the ResizeObserver are now gated on `webviewActive` so they stop when the WebView2 is suspended.
  - **Expected Result**: Only 1 active WebView2 process group in memory at a time. Switching tabs will briefly reload the preview, but RAM usage drops from ~3+ GB to near the single-tab baseline.

## [1.3.424] - 2026-07-14


### Fixed
- **RAM Usage Inflated to 3.9 GB in System Resources Widget**:
  - Root cause: `get_memory_usage` Tauri command was aggregating RSS of **all** WebView2/Chromium child processes (renderer, GPU, network, utility) into a single `desktopTotal` figure, producing a misleadingly large number (3-4 GB).
  - Refactored `get_memory_usage` in `lib.rs` to now separately track `desktopRss` (main Tauri host process only) and `webviewTotal` (aggregate RSS of all WebView2 child processes excluding the backend node process).
  - Updated `SystemStats` TypeScript interface in `useSystemStats.ts` to expose the new `webviewTotal` field.
  - Updated `Footer.tsx` tooltip to display **Main RSS** and **WebView2** on separate rows with a clear subtotal row, instead of a single inflated "App Total". The mini footer badge now shows `D: <main>+<wv>` format.

## [1.3.423] - 2026-07-14


### Changed
- **Automated Desktop Process Cleanup on Restart**:
  - Modified the development manager script `dev.js` to automatically clean up and terminate any existing, running desktop application instances (`t-line` / `t-line-dev`) before launching the dev servers.
  - This eliminates the need to manually restart the desktop app from the system tray when starting a new development build, avoiding single-instance lock deadlocks.

## [1.3.422] - 2026-07-14

### Fixed
- **Tauri ACL Permission Error for Local Preview Webviews**:
  - Modified `desktop-tauri/src-tauri/capabilities/default.json` to allow all localhost and 127.0.0.1 origins on wildcard ports (`http://localhost:*/**`, `https://localhost:*/**`, `http://127.0.0.1:*/**`, `https://127.0.0.1:*/**`) in the permitted remote URLs.
  - Resolves Uncaught (in promise) security rejections for `event.emit` and `webview.internal_toggle_devtools` commands when loaded web applications run on dynamic or custom local development server ports (e.g. 6992).

## [1.3.421] - 2026-07-14

### Fixed
- **Clean Browser-Like URL Syncing on Link Clicks**:
  - Implemented `getCleanUrl` in `BrowserTab.tsx` to automatically strip internal `/api/preview-proxy` path structures, target, and tabId query params from URL updates (updating all handlers: initial load, websocket events, Tauri events, and Electron events).
  - Updated `notifyUrlChanged()` in `tline-helper-code.ts` to call `getRealCurrentUrl()` directly, resolving to the clean target application URL instead of the raw proxy path.
  - Updated the Tauri webview URL polling code in `BrowserTab.tsx` to resolve the clean target URL using proxy target parameters before emitting events.

## [1.3.420] - 2026-07-14

### Fixed
- **Browser URL Input Syncing**:
  - Implemented popstate and hashchange event listeners in `tline-helper-code.ts` to notify the parent browser tab when client-side history navigation occurs (e.g. going back/forward or hash changes in SPAs).
  - Added Electron webview `did-navigate` and `did-navigate-in-page` event listeners in `BrowserTab.tsx` to automatically update the URL bar input on navigation.
  - Added a periodic poller `useEffect` (runs every 500ms) for native Tauri webview (`tauri-native` mode) in `BrowserTab.tsx` that evaluates the location URL inside the webview and emits a `tline-webview-event` to update the parent tab's URL input when the page changes.

## [1.3.419] - 2026-07-14

### Added
- **Browser Navigation Controls (Back & Forward)**:
  - Added "Go Back" (`ArrowLeft` icon) and "Go Forward" (`ArrowRight` icon) buttons to the top navbar in the `BrowserTab` component.
  - Implemented navigation history actions for all rendering modes (`tauri-native`, `electron-webview`, and `iframe-local`), invoking history navigation methods or evaluating history state commands respectively.

## [1.3.418] - 2026-07-14

### Fixed
- **Tauri IPC Message Queue Saturation Loop**:
  - Root cause: If a Tauri/WebView2 IPC call encountered a postMessage failure (such as "PostMessage failed ; is the messages queue full? Error code 0x80070718"), it logged an error to `console.error`. The helper code's `console.error` hook intercepted this log and tried to send it back to the parent window via another Tauri IPC call. Since the IPC queue was already full, this second call failed, logging another `console.error`, creating an infinite recursive loop of error logs and IPC calls that crashed or froze the application.
  - Added a reentrancy guard (`isSendingError`) to `sendErrorToParent` to prevent nested/recursive error captures.
  - Implemented a Tauri IPC/WebView2 failure keyword filter (`isTauriIPCError`) to completely ignore system-level message queue failures from being forwarded.
  - Added rate limiting and deduplication (`shouldThrottleError`) to drop duplicate error messages within 2 seconds and limit error logs to a maximum of 15 messages per 5 seconds.

## [1.3.417] - 2026-07-14

### Added
- **Detailed Click Logs in Element Inspector**:
  - Added comprehensive `console.log` statements in the helper script's `onClick` handler to output the raw target, resolution details, element traversal, and final dispatched payload in the browser console when an element is clicked.

## [1.3.416] - 2026-07-14

### Fixed
- **Element Inspector Click Handling & Data Extraction**:
  - Root cause: Clicking on `Text` nodes (button text, paragraph contents) or the purple inspect overlay itself (`tline-inspect-highlight`) caused an uncaught `TypeError` because `Text` nodes do not have `getAttribute` or `classList`. This aborted the dispatch of the selected element payload, preventing data from appearing in the DevTools Inspector panel.
  - Traverse up from `e.target` to find the nearest `Element` node (nodeType 1) before extracting attributes and classes.
  - Temporarily hide the highlight overlay and use `document.elementFromPoint` to locate the true underlying element if the highlight overlay itself intercepts the click event.
  - Wrapped the entire inspect-click flow in a `try...catch...finally` block so that inspect mode is always gracefully cleaned up.

## [1.3.415] - 2026-07-14

### Fixed
- **Uncaught Tauri Event Unlisten Promise Rejection**:
  - Root cause: React StrictMode or component unmounting before the async `listen` promise resolves causes `unlistenTauriEvent` to remain `null` or uncalled, leaking listeners. Calling `unlisten` in rapid sequence or on stale event state causes Tauri internal `_unlisten` to throw `Cannot read properties of undefined (reading 'handlerId')`.
  - Added an `isMounted` flag inside `BrowserTab` to guard and ignore state updates if the tab unmounts before events resolve.
  - Wrapped `unlistenTauriEvent()` call in a safety try-catch block and caught any unhandled promise rejections on the returned unlisten Promise, filtering out irrelevant `handlerId` error traces.
- **Webview Close Warning on Cleanup**:
  - Root cause: Webview instances being closed multiple times or in race conditions with already-destroyed webviews triggered `Failed to close webview on cleanup: webview not found` warnings.
  - Filtered out `webview not found` errors in the close cleanup catch block to keep the dev console clean.

## [1.3.414] - 2026-07-14

### Fixed
- **Native Webview Covers DevTools on Expand**:
  - Root cause: Tauri native webview is an OS-level overlay. When DevTools expands, DOM layout shrinks but native webview bounds stay full-height, covering Console/Inspector.
  - Added `syncWebviewBounds()` + `ResizeObserver` (with mount-retry) so container size changes force `setPosition`/`setSize` on the native webview.
  - Force bounds resync on `devtoolsHeight` / `isDevtoolsCollapsed` change (double-rAF + 220ms timeout after CSS transition).
  - Viewport area uses `min-h-0 overflow-hidden`; webview/iframe containers use `absolute inset-0` so they always match the flex-shrunk parent rect.
  - DevTools drawer gets `z-10` so DOM panel stacks above the placeholder region.

## [1.3.413] - 2026-07-14

### Fixed
- **DevTools Drawer Responsiveness & Viewport Shrinking**:
  - Removed `min-h-[250px]` from Main Browser Viewport Area, replaced with `min-h-0` so the flexbox container correctly shrinks when the DevTools drawer is expanded.
  - Added `height: '100%'` to the `tauri-native` container div so the `updateLoop` correctly reads shrunken bounds and syncs the native webview size.
  - Proactively fetch and inject `TLINE_HELPER_CODE` from `/api/preview-proxy/tline-helper.js` into the native Tauri webview when the Inspect button is pressed, with `__TLINE_TAB_ID__` and `__TLINE_NATIVE__ = true` flags prepended.
  - Split Tauri `tline-webview-event` listener into its own dedicated `useEffect` with minimal deps so it is registered at component mount rather than after the async WS handler, preventing missed element-selection events.

## [1.3.412] - 2026-07-13

### Fixed
- **Browser Tab Tauri-Native Inspect (Element Picker)**:
  - Fixed root bug: `tline-element-selected` events from Tauri native webview never reached the React app because `window.parent.postMessage()` is a no-op in native webviews (`window.parent === window`) and the HTTP POST fallback only activates when `isProxied` is true.
  - Added Tauri event bus path in `sendPreviewEvent` (`tline-helper-code.ts`): when `isTauri` is true, emits `tline-webview-event` via `window.__TAURI__.event.emit()` directly to the Tauri event system.
  - Added `listen('tline-webview-event')` in `BrowserTab.tsx` WebSocket useEffect: native webview events (element-selected, error, url-changed, ready) now route through Tauri event bus instead of the broken postMessage/HTTP path.
  - Fixed stale closure bug: removed `isInspecting` from `handleMessage` useEffect dep array — listener no longer tears down mid-event, preventing dropped `tline-element-selected` messages in iframe mode.
  - Added `renderMode === 'iframe-local'` guard on `toggleInspect` iframe postMessage path to prevent sending inspect commands to wrong targets in cross-origin or proxy iframe modes.

## [1.3.411] - 2026-07-13

### Changed
- **Browser Shell Rewrite without Proxy Dependency**:
  - Rewrote the app preview engine to bypass the proxy connection layer entirely.
  - Embedded native Webviews (`tauri-native` / `electron-webview`) directly in desktop runtime layouts.
  - Added fallback routing for browser/web context to safely present external links natively or external-site actions.
  - Removed `forceProxy` and `bypassProxy` configuration modes, reducing component size and complexity.
  - Split `BrowserTab.tsx` by extracting drawer markup into a modular child component (`BrowserDevTools.tsx`), bringing files well under the 1000 lines threshold.

## [1.3.410] - 2026-07-13

### Fixed
- **Browser Preview Inspection & Interactivity**:
  - Corrected syntax errors in the client-side helper script (`tline-helper-code.ts`) caused by invalid double backslash escapes (`\\\\/\\\\//` instead of `\\/\\//` in the TS template literal backticks).
  - Resolved event propagation blocks and page navigation freeze when clicking links or submitting forms under the preview proxy by modifying `href`/`action` attributes dynamically for matching targets without calling `preventDefault`/`stopPropagation`.
  - Added support for reading and parsing the `tline_tab_id` cookie to resolve context losses for tab states on external/system browsers.
  - Capped the client-side `tline-ready` handshake retry to 10 attempts to avoid spamming backend WebSocket endpoints in system browsers.

## [1.3.409] - 2026-07-13

### Fixed
- **Show Dashboard Tray Restore**:
  - Restructured the Tauri tray click handler (`on_tray_icon_event`) to listen to both single `Click` and `DoubleClick` events.
  - Corrected the method execution order in `show_dashboard_window` to call `unminimize()` before `show()` and `set_focus()`.
  - Removed the forced maximize behavior to respect user preferences and prevent WebView2 window focus/rendering blocks on Windows.

## [1.3.408] - 2026-07-13

### Fixed
- **Web Preview Handshake Reliability**:
  - Implemented a periodic retry interval for sending the `tline-ready` event from the client helper script (`tline-helper-code.ts`) until it is acknowledged by the parent window.
  - Added parent-to-child `tline-ack-ready` message acknowledgements in `BrowserTab.tsx` for both iframe (postMessage) and Tauri native webview (eval_webview_js) flows, resolving cases where the status indicator could get stuck on "Connecting Helper..." due to early/missed handshake events.

## [1.3.407] - 2026-07-13

### Fixed
- **Web Preview Proxy & Redirects**:
  - Refactored `sanitizeHeaders` in `previewProxy.ts` to merge custom cookies (`tline_tab_id` and `tline_proxy_target`) into the outgoing response headers, preventing them from being overwritten by cookies returned by the target application server.
  - Implemented relative redirect path resolution against the target application server's origin to prevent relative redirects (e.g. `/dashboard`) from breaking out of the proxy and causing 404 errors.
  - Added suffix-based Vite dev port detection (`endsWith(':5773')`) in `BrowserTab.tsx` and `websocket.ts` to support all loopback interfaces (like `[::1]`) and local IP address bindings.
- **Client-Side Injected Helper Improvements**:
  - Modified click and submit event listeners in `tline-helper-code.ts` to resolve links and actions relative to the target application's base URL instead of `window.location.href`, preventing loops back into the proxy.
  - Added robust validation in both backend and frontend to discard `"null"` and `"undefined"` string literals for tab ID and target URL parameters.
  - Replaced property-based ID calls with `getAttribute('id')` to avoid browser DOM property pollution (where elements like `<input name="id">` contaminate the parent form ID object).

## [1.3.406] - 2026-07-13

### Fixed
- **Cookie-Based tabId Session Persistence**:
  - Implemented cookie-based persistence for `tabId` (`tline_tab_id`) in `previewProxy.ts`. By setting a tecredited `Set-Cookie` header on the first request and parsing the cookies header on subsequent requests, the `tabId` is safely retained for every page request and sub-resource load under the proxy origin, preventing the `tabId` from resolving as `null` after complex redirection paths or navigations.

## [1.3.405] - 2026-07-13

### Fixed
- **HTTP Redirects tabId Preservation in Proxy**:
  - Updated the `sanitizeHeaders` function in the backend `previewProxy.ts` to accept the request object and append `tabId` as a query parameter when rewriting HTTP `Location` redirect headers. This ensures `tabId` is not lost on target website redirects (like `google.com` to `google.co.id` or trailing slash redirects) before the helper script can run and persist it in client-side storage.

## [1.3.404] - 2026-07-13

### Added
- **Proxy Port and Frontend Dev Port to Tauri Remote Capability Scope**:
  - Added authorization rules in `default.json` for remote URL patterns `http://localhost:5779/**` (backend proxy) and `http://localhost:5773/**` (frontend dev). This resolves permission rejections (`webview.internal_toggle_devtools not allowed...`) when WebViews serving proxied web pages try to trigger native Tauri commands.
- **WebSocket & Proxy Event Logging**:
  - Added backend console logs in the `/api/preview-proxy/event` route and frontend console logs in the WebSocket message listener of `BrowserTab.tsx` to simplify debugging of inspector and error events.

## [1.3.403] - 2026-07-13

### Fixed
- **Element Inspector Loss of Tab ID on Navigation**:
  - Persisted the workspace `tabId` using client-side `sessionStorage` (`tline_tab_id`) inside the `tline-helper.js` script. This prevents the `tabId` from being lost during full-page reloads, redirects, or navigation (which strips query parameters), ensuring that element inspection and error events continue to be correctly routed via WebSocket to the appropriate parent tab in the main interface.

## [1.3.402] - 2026-07-13

### Fixed
- **Tauri Webview Bounds Sync "Webview Not Found" Warnings**:
  - Suppressed the console warnings and failed state triggers for temporary `webview not found` errors inside the updateLoop bounds syncing logic and show/hide transition catch handlers. These transitions occur normally during asynchronous creation/destruction/unmounting phases when switching tabs or reloading.

## [1.3.401] - 2026-07-13

### Fixed
- **Stuck Connecting Helper Status Text**:
  - Implemented dynamic status text and dot color functions (`getHelperStatusText`, `getHelperStatusColorClass`) for the Web Preview DevTools status indicator.
  - Corrected the state display to show "Waiting for preview URL..." (gray dot) when no URL is entered, and "Direct Mode Active" (green dot) when running in Tauri Direct Mode (where the proxy helper is bypassed), resolving confusing/incorrect "Connecting Helper..." prompts.

## [1.3.400] - 2026-07-13

### Fixed
- **Bypass Proxy for Tauri Internal IPC & Protocols**:
  - Added a check in `tline-helper.js` to prevent intercepting and proxying Tauri internal hostnames and protocols (like `ipc.localhost`, `tauri.localhost`, and `tauri://`). This resolves 404/502/403 errors when Tauri's injected scripts trigger native IPC actions (such as `plugin:webview|internal_toggle_devtools`) within a proxied Web Preview window.

## [1.3.399] - 2026-07-13

### Fixed
- **Browser Tab Side-by-Side Duplicate Rendering**:
  - Only render the BrowserTab placeholder block in the main workspace DOM when the tab is detached. This prevents the placeholder (globe icon and "Browser Tab" text) from rendering side-by-side with the persistent live `<BrowserTab>` when a browser preview is active.

## [1.3.398] - 2026-07-13

### Added
- **Multi-Platform Update Checker**:
  - Re-enabled the manual "Check" update button in the Settings modal for all platforms (Tauri desktop and Web browsers).
  - Integrated the native Tauri auto-updater (`tauri-plugin-updater` v2) in `src-tauri` and exposed `check_tauri_update` and `install_tauri_update` custom Rust commands.
  - Implemented a graceful fallback to checking the GitHub Releases API directly if running in a Web browser or if the Tauri native updater is not fully configured (e.g. missing signature keys).
  - Added a "Download" button in the Settings UI linking directly to the repository's GitHub release page when an update is found in Web/Fallback mode.

## [1.3.397] - 2026-07-11

### Added
- **System Tray Terminal Navigation**:
  - Implemented the ability to click any active PTY session in the system tray menu to instantly switch the active workspace (project) and tab in the main interface.
  - Added a new `focus_window` Tauri command to focus detached windows when switching to a terminal in a detached tab (dual-display mode).
  - Used React refs (`tabsRef`, `terminalInstancesRef`) in `App.tsx` for optimal, stable event listening.

## [1.3.396] - 2026-07-11

### Fixed
- **Tauri Webview ACL Permissions**:
  - Added `"webviews"` glob pattern array to the default capability definition in `desktop-tauri/src-tauri/capabilities/default.json` matching `"main"` and `"browser-*"` to correctly allow dynamically created programmatic child webviews to invoke custom commands (such as `get_memory_usage`).
  - Added `"core:webview:allow-internal-toggle-devtools"` permission to resolve `plugin:webview|internal_toggle_devtools` ACL rejection crashes when programmatically opening devtools in Tauri preview tabs.

## [1.3.395] - 2026-07-11

### Fixed
- **Production Updater Version Detection**:
  - Bundled `backend/package.json` into the Tauri installer resources under the `_up_/backend/` layout so that the Node.js backend can successfully read and return the correct production version from disk.
  - Added support for reading version from `process.env.APP_VERSION` when running inside the Tauri shell environment.
  - Aligned fallbacks and package version declarations to `1.3.395` to ensure the update notifications and badges work accurately without displaying incorrect outdated statuses in production.

## [1.3.394] - 2026-07-11

### Fixed
- **Headless & Background Backend Execution on Windows**:
  - Configured Tauri subprocess spawner on Windows to spawn all child command prompt, powershell, node, npm, and taskkill processes headlessly with `creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) to prevent console windows from popping up or remaining visible in the foreground.
  - Declared app custom commands in `build.rs` via `AppManifest::commands` so that Tauri v2 autogenerates permission identifiers at compile time, and updated `capabilities/default.json` to allow them individually.

## [1.3.393] - 2026-07-11

### Fixed
- **Tauri RAM Detection & Custom Command Permissions**:
  - Restored the `custom-commands-permission` block in `capabilities/default.json` to allow the frontend to invoke kustom commands (`get_memory_usage`, `open_webview_devtools`, `eval_webview_js`, `create_detached_window`, `close_detached_window`, `get_app_url`, `start_backend_command`, `quit_app`) without throwing permission denied errors.
  - Refactored `get_memory_usage` in `lib.rs` to recursively walk the process tree and aggregate RAM usage of all descendant processes (including WebView2 utility, renderer, and GPU grandchild processes).
  - Ensured backend Node.js process and its descendants are recursively excluded from the total desktop RAM calculation to avoid double-counting.

## [1.3.392] - 2026-07-11

### Fixed
- **Terminal Double Cursor Caret with Superagent**:
  - Automatically detect when the Superagent AI coding agent CLI (`isSuperagent`) is running in a terminal instance.
  - Dynamically hide the xterm.js cursor by setting the theme's `cursor` and `cursorAccent` to `'transparent'` whenever Superagent is active, ensuring it does not collide/render double with Superagent's own custom cursor.
  - Added a `.hide-xterm-cursor` class style with `visibility: hidden !important` applied to `.xterm-cursor` as a CSS fallback mechanism.

## [1.3.391] - 2026-07-10

### Fixed
- **Tauri Window Controls**:
  - Added missing permissions (`core:window:allow-is-maximized`, `core:window:allow-maximize`, and `core:window:allow-unmaximize`) to `capabilities/default.json` to resolve permission denied crashes when verifying window maximization state in production built installers.
  - Refactored `App.tsx` window control actions to safely invoke the global `window.__TAURI__.window` object directly when available (which is populated synchronously when `withGlobalTauri` is enabled), completely bypassing dynamic ESM import and chunk loading issues in built release installations.
  - Explicitly added `@tauri-apps/api` to `frontend/package.json` dependencies to ensure correct compilation and bundling.

## [1.3.390] - 2026-07-10

### Changed
- **Documentation & Release**:
  - Updated `README.md` to document new features (detached tabs with blurred lock screens, async multi-display stability fixes, custom window decorations, terminal footer controls, and non-destructive tray restore).
  - Bumped version to `1.3.390` across all packages, Cargo configuration, and Tauri settings.

## [1.3.389] - 2026-07-10

### Fixed
- **Detached Window DevTools**:
  - Removed the automatic devtools popup (`open_devtools`) when creating detached WebviewWindows in the Rust backend for debug builds, preventing intrusive debug panels.

## [1.3.388] - 2026-07-10

### Changed
- **Detached Window Styling**:
  - Disabled native OS decorations (`decorations(false)`) on detached Tauri windows in the Rust backend to prevent duplicate title bars, relying entirely on the custom React-rendered header and window controls.

## [1.3.387] - 2026-07-10

### Fixed
- **Detached tab state client-side preservation**:
  - Merged local `isDetached` state flag when updating client states from WebSocket `sync_state` updates and HTTP `fetchSyncState` responses, preventing backend synchronizations from wiping out client-side lock state.

## [1.3.386] - 2026-07-10

### Fixed
- **Detached Tab Selectability and Instant Lock transition**:
  - Disabled automatic switching of active tabs when a tab is detached, so the current tab remains selected and instantly transitions into the premium lock overlay.
  - Allowed users to click on detached tab buttons in the tab bar/sidebar to select them in the main window (viewing the locked screen) while simultaneously focusing/restoring the detached window.

## [1.3.385] - 2026-07-10

### Added
- **Detached Tab Lock Overlay and Tab Indicators**:
  - Replaced the blank `Tab Detached` placeholder screen with a frozen/blurred view of the actual tab contents under a frosted-glass overlay with a pulsing lock icon.
  - Replaced the generic `ExternalLink` icon on detached tab buttons with a custom lock icon badge (`Lock` icon inside a small rounded capsule) to clearly indicate a detached/locked tab.
  - Added a "Re-attach Workspace" button inside the lock overlay to easily merge it back into the main window.

## [1.3.384] - 2026-07-10

### Changed
- **Relocated Terminal Controls to Footer Terminal (Status Bar)**:
  - Moved Zoom Out, Font Size Indicator, Zoom In, Shell Selector, Refresh/Restart, and Scroll to Bottom controls from the global app footer (`Footer.tsx`) to each individual terminal's status bar/footer (`TerminalStatusBar` in `TerminalSubComponents.tsx`).
  - Added new clean, premium styling (`.terminal-status-center`) for the controls inside the 22px-high status bar.
  - Extended prop propagation through `App.tsx`, `SplitLayoutRenderer.tsx`, and `TerminalGridTab.tsx` to pass the necessary state and handlers directly down to `TerminalInstance.tsx` and `TerminalStatusBar` (including for detached tabs and windows).
  - Cleaned up unused props in `Footer.tsx` and `App.tsx`.

## [1.3.383] - 2026-07-10

### Fixed
- **Detached Dual Screen Window Crash**:
  - Changed `create_detached_window` and `close_detached_window` Tauri commands to be asynchronous (`async fn`) in the Rust backend.
  - This prevents blocking/deadlocking the main GUI thread during WebView2 creation and monitor configuration queries, resolving crashes/freezes on Windows setups with dual displays.
- **Show Dashboard Tray Restore**:
  - Removed the destructive and crash-prone navigation/reload logic from `show_dashboard_window` in the Rust backend.
  - This ensures that restoring or showing the main window from the tray does not reload the frontend, preserving the active user workspace (terminal sessions, scrollbacks, and file edits) and avoiding WebView2 deadlocks on Windows.

## [1.3.382] - 2026-07-10

### Fixed
- **Detached Browser Tab Blank Window**:
  - Stopped the main window from keeping detached browser tabs mounted as hidden native Tauri webviews, preventing duplicate child webviews from fighting over the same preview tab.
  - Encoded detached-window query parameters with `URLSearchParams` so auth tokens and tab IDs are passed safely to new windows.
## [1.3.381] - 2026-07-10

### Fixed
- **Tray Show Dashboard Restore**:
  - Reworked Show Dashboard, tray click, and single-instance restore to use one shared main-window restore path.
  - Reloads the dashboard URL when the backend is running, then shows, unminimizes, maximizes, and focuses the main app window.

## [1.3.380] - 2026-07-10

### Fixed
- **Detached Tab White Window and Close Control**:
  - Passed detached-tab context through Tauri's initialization script instead of an unsupported query string on `WebviewUrl::App` asset paths.
  - Restored the detached tab ID and auth token before React initializes, so the bundled production app can render the intended tab.
  - Force-destroy detached windows on a native close request, ensuring stuck blank windows can always be closed.

## [1.3.379] - 2026-07-10

### Fixed
- **Detached Tab Blank Window**:
  - Restored Tauri's bundled application protocol for detached windows in production, preventing a blank page when the backend is not serving frontend assets.
  - Kept Vite as the development source and normalized detached-window URLs to include the SPA root path.

## [1.3.378] - 2026-07-10

### Fixed
- **Tauri Native Webview Initialization**:
  - Prevented native child webview creation before its React container is mounted and a preview URL is available.
  - Guarded all container bounds reads during initialization and visibility synchronization, eliminating repeated `getBoundingClientRect()` calls on a null ref.

## [1.3.377] - 2026-07-10

### Fixed
- **Dual Screen / Detached Tab (production blank window)**:
  - Root cause: detached window used `tauri::WebviewUrl::External` with a URL built from `window.location.origin`. In production builds `window.location.origin` resolves to `tauri://localhost` (Tauri's virtual asset protocol, not a real network address), so the external webview failed to load and opened blank.
  - Fix: `create_detached_window` now accepts a `query` string and opens the bundled app via `tauri::WebviewUrl::App(PathBuf)` (works in both dev and production). Frontend invoke calls pass `query = token=...&detachedTabId=...` instead of a full origin-based URL.

## [1.3.376] - 2026-07-10

### Added
- **Dual Screen / Detached Tab Support**:
  - Implemented the ability to detach any tab or grid into a separate Tauri WebviewWindow.
  - Added new Tauri commands `create_detached_window` and `close_detached_window` in Rust backend.
  - Integrated `storage` event synchronization in the frontend to keep tab lists and terminal instances in real-time sync across windows.
  - Added visual indicators for detached tabs in the tab bar and a placeholder view for detached tabs in the main window.

## [1.3.375] - 2026-07-10

### Fixed
- **Tauri Custom Window Controls**:
  - Replaced the global `window.__TAURI__.window` reference with explicit dynamic import of `@tauri-apps/api/window` to resolve issues where minimize and maximize controls were not functioning in the Tauri desktop wrapper.
  - Implemented robust, race-condition-free event subscription for window resize state tracking in `App.tsx`.

## [1.3.374] - 2026-07-09

### Fixed
- **Tauri Installed Backend Startup**:
  - Updated resource path resolution inside `desktop-tauri/src-tauri/src/lib.rs` to lookup the backend script at both `_up_/backend/dist/server.js` and `backend/dist/server.js`. This resolves issues where Tauri bundles resources with an `_up_` prefix relative to the `src-tauri` folder.
  - Stripped the Windows UNC long-path namespace prefix (`\\?\\`) from the script path before passing it to `node`. This prevents the Node.js module loader from crashing with `EISDIR` path resolution errors at startup.

## [1.3.373] - 2026-07-08

### Fixed
- **Tauri Native Webview Mount Visibility**:
  - Resolved a race condition where the newly created native child webview overlay remained hidden on initial mount when the tab was active. Added an immediate explicit `.show()` call during the `initWebview` initialization flow if `isActiveRef.current` is true.

## [1.3.372] - 2026-07-08

### Added / Fixed
- **Cookie Sanitization & Direct Mode Toggle**:
  - Implemented automatic cookie attribute stripping (`Domain` and `Secure` attributes) in the preview proxy middleware. This allows target websites to set cookies and persist sessions on `http://localhost:5779` under Proxy Mode.
  - Added a **"Direct Mode / Proxy Mode"** toggle button in the BrowserTab toolbar for Tauri Webviews, allowing developers to bypass the proxy completely and load sites directly (enabling complex OAuth redirects and native secure cookies).

## [1.3.371] - 2026-07-08

### Fixed
- **Tauri Webview Inspect Element Mode**:
  - Replaced the direct (and unsupported in JS API) `webview.eval()` call with a custom backend Tauri command `eval_webview_js` to evaluate JavaScript commands inside target child webviews. This fixes the issue where the kursor inspect state was not toggling inside Tauri native Webview instances.

## [1.3.370] - 2026-07-08

### Fixed
- **Tauri Compilation Error**:
  - Removed the invalid `"core:webview:allow-eval"` permission entry from `capabilities/default.json` which was causing a panic (exit code 101) during `tauri dev` / `cargo run`. (In Tauri v2, webview JavaScript evaluation is a host-only API and does not require this guest capability).

## [1.3.369] - 2026-07-08

### Added / Changed
- **WebSocket-Bridged Webview Inspection and Logging for Tauri**:
  - Integrated a custom event bridging system that routes child webview click selection, console error capture, and load ready events via the Express proxy to the main UI window.
  - Implemented HTTP POST `/api/preview-proxy/event` on the Express backend to capture events from the helper script and broadcast them to all active WebSocket clients.
  - Configured `previewProxy.ts` to attach `tabId` to each proxied document request and inject `window.__TLINE_TAB_ID__` to partition events correctly.
  - Added WebSocket listeners in `BrowserTab.tsx` to handle logs and element selections, enabling the bottom DevTools drawer in Tauri mode.
  - Enabled programmatic script injection and inspect toggling in Tauri child Webviews using `Webview.eval()`, and granted the necessary `"core:webview:allow-eval"` capability.

## [1.3.368] - 2026-07-08

### Changed
- **Agent Rules Update**:
  - Updated rules in [AGENTS.md](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/.agents/AGENTS.md) to replace references to the deprecated Electron desktop component with `desktop-tauri`.

## [1.3.367] - 2026-07-08

### Added / Fixed
- **Tauri Native Webview in Browser Tab**:
  - Activated the native child Webview overlay for the Tauri platform by default (`useTauriWebview = isTauri`), replacing the iframe preview proxy for better performance, cookies, and login session support.
  - Changed the dynamic webview window label prefix from `inline-browser-webview-` to `browser-webview-` to align with the permitted glob pattern `browser-*` in `capabilities/default.json`. This resolves permission restrictions on bounds resizing and DevTools invocation in Tauri v2.
  - Cleaned up the user interface by hiding the custom React-based DevTools drawer when the native Webview is active, since users have access to native Developer Tools via the "Open DevTools" button.

## [1.3.366] - 2026-07-08

### Removed
- **Browser Pop-out Button**:
  - Removed the "Pop-out" external browser link button from the Browser tab toolbar.
  - Cleaned up the unused `openInTauriBrowser` helper function inside `BrowserTab.tsx`.

## [1.3.365] - 2026-07-08

### Fixed
- **Tauri CI/CD Build Failures**:
  - Restructured the Tauri bundling resource configuration to exclude the root `node_modules` directory, preventing compilation failures caused by symbolic links (symlinks) inside devDependencies (like `@tauri-apps/cli`) on headless GitHub Actions runners.
  - Updated `copy-assets.js` to run `npm install --omit=dev` directly inside `desktop-tauri/backend/` during the assets copy phase, and cleaned up any symlink directories (`.bin`) before bundling. This minimizes final installer size (saving ~50MB+) and ensures all backend dependencies are cleanly packaged.
  - Corrected the `swatinem/rust-cache` cache workspaces target paths inside `.github/workflows/release.yml`.

## [1.3.364] - 2026-07-08

### Fixed
- **Preview Proxy originalUrl Rewrite**:
  - Rewrote both `req.url` and `req.originalUrl` inside the host-relative fallback middleware in `backend/src/server.ts`. This allows the path filter in `http-proxy-middleware` to recognize host-relative requests (like `/gen_204`) correctly and forward them.

## [1.3.363] - 2026-07-08

### Fixed
- **Preview Proxy Target Hijacking**:
  - Restructured routing logic in `backend/src/previewProxy.ts` so that subresource requests (fetch/XHR, images, scripts) specifying a target parameter do not overwrite the global `currentProxyTarget` or the main session cookie `tline_proxy_target`. This ensures cross-origin APIs loaded by the previewed site do not break main site asset loading.
- **Host-Relative 404 Routing Fallback**:
  - Added a fallback Express middleware in `backend/src/server.ts` to capture unmatched host-relative requests (like `/gen_204`) from the preview frame and rewrite/redirect them through the preview proxy.

## [1.3.362] - 2026-07-08

### Fixed
- **Terminal WebSocket Upgrade Conflict**:
  - Resolved `failed: Invalid frame header` error on terminal WebSocket connections by adding a `pathFilter` to `http-proxy-middleware`'s config inside `backend/src/previewProxy.ts`. This prevents the proxy from intercepting and corrupting websocket upgrades intended for the terminal WebSocket at `/`.

### Changed
- **Backend Refactoring & Code Length Compliance**:
  - Extracted the web preview proxy logic, sanitize headers function, and temporary state variables from `backend/src/server.ts` into a new modular file `backend/src/previewProxy.ts`. This reduces the size of `server.ts` from 1,174 lines to ~950 lines, satisfying the strict 1,000-line code file limit rule.

## [1.3.361] - 2026-07-08

### Fixed
- **Dev Mode Frontend Restart Loop / Port Conflict**:
  - Fixed an issue where the Rust backend failed to detect that Vite was already running on port 5773 because Vite was bound to the IPv6 loopback (`[::1]`) while the detection logic only checked the IPv4 loopback (`127.0.0.1`).
  - Updated `is_port_active` in `desktop-tauri/src-tauri/src/lib.rs` to check both `127.0.0.1` and `[::1]`.
  - Updated `checkPort` in `dev.js` to also check both `127.0.0.1` and `::1` loopbacks.
  - This prevents Tauri from spawning a duplicate frontend dev process that killed the active one and crashed the launch runner.

## [1.3.360] - 2026-07-08

### Fixed
- **xterm.js Viewport Initialization Warning**:
  - Silenced the expected uncaught TypeError `Cannot read properties of undefined (reading 'dimensions')` during xterm.js syncScrollArea initialization.
  - Added a check for renderer readiness (`core._renderService._renderer`) before delegating to `originalSyncScrollArea` inside `TerminalInstance.tsx`.

## [1.3.359] - 2026-07-08

### Changed
- **Dynamic Theming on Connection Error Page**:
  - Dynamically style the offline reconnection/connection error screen (`error.html` and the rust fallback string) based on the user's active theme and fonts stored in `localStorage`.
  - Added links to Google Fonts inside `error.html` and configured Content-Security-Policy (CSP) to allow styling and fonts from Google sources.
  - Implemented dot-grid backgrounds and radial accent glows to match the design aesthetics of the rest of the application.

## [1.3.358] - 2026-07-08

### Fixed
- **Race Condition on Vite Dev Server Startup**:
  - Added a 3-second startup delay check for the Vite dev server port (`5773`) in the Rust backend before attempting to spawn a new instance.
  - This prevents Tauri from spawning duplicate Vite instances and clashing/killing the frontend dev server when running the application via the main orchestrator script (`npm run dev`).

## [1.3.357] - 2026-07-08

### Fixed
- **Tauri IPC Origin Validation on Connection Error Page**:
  - Moved the offline connection error screen from a `data:` URI (which has a `null` origin and blocks Tauri IPC calls) to a static `error.html` served under the local asset protocol (`tauri://localhost/error.html` or `http://tauri.localhost/error.html` in production, and `http://localhost:5773/error.html` in development).
  - This preserves the localhost/app origin context, resolving the `"Origin header is not a valid URL"` error and allowing the "Start Backend" and window commands to successfully execute via Tauri IPC.

## [1.3.356] - 2026-07-08

### Added
- **Window Controls for Pre-Auth and Connection Error Screens**:
  - Added a draggable custom title bar with minimize, maximize, and close buttons to the connection error page template.
  - Implemented window controls support on the client-side pre-auth screens (Login, Loading, and Setup) to provide consistent frame controls on frameless windows.

## [1.3.355] - 2026-07-08

### Removed
- **Close Button on Connection Error Page**:
  - Removed the "Close App" button and the `quitApp` JS function from the backend offline error page.
  - Updated the error text to remove reference to closing the app.
  - Removed the corresponding `error_page_close_uses_invoke` unit test.

## [1.3.354] - 2026-07-08

### Fixed
- **Pembersihan Port dan Validasi Backend**:
  - Menambahkan pembersihan proses port `5773` dan `5779` secara otomatis di `dev.js` saat startup untuk menghindari konflik port (Address In Use) dari sisa proses sebelumnya yang menggantung.
  - Memperbarui pengecekan backend di Tauri (`lib.rs`) agar melakukan request validasi dengan bypass token. Jika port aktif namun tidak merespons atau token tidak cocok (misal dari sisa proses backend lama), proses tersebut langsung di-kill dan backend baru dijalankan secara bersih.
  - Menambahkan endpoint `/api/health` di backend agar halaman error offline di webview tidak terjebak dalam loop refresh tiada henti (reload loop) karena mendapatkan 404 pada health check.
  - Menambahkan deklarasi izin `custom-commands-permission` di `capabilities/default.json` Tauri agar command Rust kustom (`quit_app`, `start_backend_command`, `get_memory_usage`, `open_webview_devtools`) bisa dipanggil oleh frontend, memperbaiki tombol "Close App" dan interaktivitas lainnya.

## [1.3.353] - 2026-07-08

### Added
- **Navigasi Otomatis Halaman Error**:
  - Mengekstraksi pembuatan dan pemuatan halaman error webview ke fungsi helper terpusat `show_error_page(&app_handle)`.
  - Mengintegrasikan `show_error_page` ke dalam `stop_backend_async` dan loop `poll_backend` (ketika status terdeteksi berubah menjadi `"stopped"`), sehingga t-line langsung memuat halaman error secara real-time saat backend dimatikan oleh user atau mendadak crash.

## [1.3.352] - 2026-07-08

### Fixed
- **Deteksi Root Workspace di Dev Mode**:
  - Memperbaiki `find_workspace_root()` agar memeriksa keberadaan direktori `desktop-tauri` selain `backend` dan `package.json`. Ini mencegah folder `desktop-tauri` (yang juga memiliki folder `backend` hasil copy-assets dan `package.json`) disalahartikan sebagai root workspace saat pengembangan.
- **Interaktivitas Error Page**:
  - Menambahkan tombol aksi **Start Backend** dan **Close App** di halaman error webview.
  - Mendaftarkan command baru di Rust (`quit_app` dan `start_backend_command`) dan mengintegrasikannya dengan UI HTML error page menggunakan global Tauri core invoke API.

## [1.3.351] - 2026-07-08

### Added
- **Status Loading pada Tray Menu**:
  - Menambahkan status `"stopping"` untuk backend, sehingga saat mematikan/restart backend, status menu tray langsung menampilkan `t-line: Stopping...` dan menonaktifkan seluruh tombol aksi (Start/Stop/Restart).
  - Mengubah penanganan aksi tray "Stop Backend" dan "Restart Backend" menjadi asynchronous (`stop_backend_async` dan `restart_backend_async`) untuk mencegah menu tray membeku (freeze) selama port dilepaskan.
  - Memperbarui status backend ke `"running"` secara instan di menu tray begitu server aktif dalam thread `spawn_backend`, mengurangi delay polling dari 3 detik menjadi instan.

## [1.3.350] - 2026-07-08

### Added
- **Otomatisasi Backend dengan Tauri Dev**:
  - Mengubah script `tauri` dan `dev:tauri` di root `package.json` untuk menjalankan `node dev.js tauri`.
  - Memperbarui `dev.js` agar secara otomatis menjalankan dev server backend (port 5779) dan dev server frontend (port 5773) saat `tauri dev` dijalankan, serta mematikan semuanya secara bersih saat Tauri ditutup.

### Fixed
- **Masalah Restart/Start Backend di System Tray**:
  - Memperbaiki race condition di mana `restart_backend` mencoba memulai ulang backend sebelum port 5779 benar-benar dilepas oleh proses lama.
  - Memodifikasi `stop_backend` di Rust (`lib.rs`) agar menunggu terminasi pohon proses (menggunakan `taskkill /f /t` di Windows) dan mem-poll port hingga bersih (maksimal 2 detik).
  - Menambahkan fallback `kill_port_process` menggunakan PowerShell di Windows untuk memaksa mengakhiri proses apa pun di port 5779 jika backend_child bernilai `None`.
  - Menambahkan deteksi root workspace di `lib.rs` untuk menjalankan dev server backend via `npm run dev:backend` jika backend dist belum dikompilasi saat pengembangan.

## [1.3.349] - 2026-07-08

### Fixed
- **Tauri Devtools Compilation in Production Build**:
  - Mengaktifkan feature `"devtools"` pada dependensi `tauri` di dalam [Cargo.toml](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/Cargo.toml) untuk memperbaiki error kompilasi Rust `no method named open_devtools found` saat mem-build aplikasi dalam mode rilis/produksi di runner CI/CD.

## [1.3.348] - 2026-07-07

### Added
- **Ad-Hoc macOS Code Signing**:
  - Menambahkan konfigurasi `"macOS": { "signingIdentity": "-" }` di dalam [tauri.conf.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/tauri.conf.json) untuk menggunakan tanda tangan ad-hoc secara default pada target macOS. Ini menghindari kegagalan build/codesign di GitHub Actions runner yang tidak memiliki sertifikat Apple developer terkonfigurasi.

### Changed
- **Verbose Build Logs in CI**:
  - Menambahkan argumen `args: --verbose` pada langkah `Build Tauri Desktop` di `.github/workflows/release.yml` ([release.yml](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/.github/workflows/release.yml)) untuk mencetak detail kompilasi Cargo dan Tauri secara mendalam demi kemudahan debugging jika ada error di runner.

## [1.3.347] - 2026-07-07

### Fixed
- **Tauri Action Version in Workflow**:
  - Mengubah referensi `tauri-apps/tauri-action` dari `@v2` ke `@v0` di dalam `.github/workflows/release.yml` ([release.yml](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/.github/workflows/release.yml)) untuk memperbaiki error resolusi tag action pada server runner GitHub Actions.

## [1.3.346] - 2026-07-07

### Removed
- **Penghentian Dukungan Desktop Electron**:
  - Menghapus folder workspace `desktop/` secara permanen karena pengembangan resmi dialihkan sepenuhnya ke desktop Tauri.
  - Menghapus referensi workspace `desktop` dari root [package.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/package.json) serta menghapus script `build:desktop` dan `desktop`.
  - Memperbarui script `build:exe` di root [package.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/package.json) untuk langsung menjalankan build Tauri (`npm run build:tauri`).

### Changed
- **Migrasi Workflow GitHub Actions**:
  - Menghapus langkah `Build Electron Desktop` dari file workflow rilis `.github/workflows/release.yml` ([release.yml](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/.github/workflows/release.yml)) sehingga rilis multi-platform di GitHub Actions hanya berfokus pada build dan publikasi installer desktop-tauri.
  - Meningkatkan versi aplikasi ke `1.3.346` di seluruh workspace (root, backend, frontend, desktop-tauri, dan konfigurasi tauri).

## [1.3.345] - 2026-07-07

### Added
- **Intercept Fetch and XMLHttpRequest in Preview Proxy**:
  - Meng-override `window.fetch` dan `window.XMLHttpRequest` di dalam script pembantu pratinjau `tline-helper.js` ([tline-helper-code.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/tline-helper-code.ts)) untuk merutekan request API dan asset relatif/absolut melewati proxy `/api/preview-proxy`, menyelesaikan masalah CORS dan relative-path URL resolving.
- **Case-Insensitive Security Header & Meta Tag Removal**:
  - Menghapus header security (`Content-Security-Policy`, `X-Frame-Options`, dll.) dan meta tag `<meta http-equiv="Content-Security-Policy" ...>` secara case-insensitive saat merender halaman proxied untuk menghindari pemblokiran iframe.
- **Automatic Port 3000 to 4333 Migration**:
  - Menambahkan migrasi otomatis untuk tab preview lokal yang tersimpan di `localStorage` ([useTerminals.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminals.ts)) dan file sinkronisasi pusat ([server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts)) dari port `3000` ke `4333`.

## [1.3.344] - 2026-07-07

### Changed
- **Update Default Web Preview Port Preset to 4333**:
  - Mengubah placeholder input URL lokal dan preset port dari port `3000` menjadi `4333` di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) untuk menghindari konflik port.

## [1.3.343] - 2026-07-07

### Changed
- **Remove Shadows from Web Preview Cards & Buttons**:
  - Menghapus property `box-shadow` pada card dan button di halaman offline proxy [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts).
  - Menghapus class `shadow-lg` pada native React welcome card di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx).
  - Ini memberikan gaya flat minimalis yang lebih bersih dan modern, selaras dengan estetika Obsidian.

## [1.3.342] - 2026-07-07

### Changed
- **Set Default Proxy Target to Empty**:
  - Mengubah default target proxy dari `https://www.google.com` menjadi kosong (`""`) di [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts).
  - Ini memastikan proxy server tidak lagi membuka Google secara default jika tidak ada target URL spesifik yang didefinisikan, melainkan langsung menyajikan halaman Welcome/Offline Preview yang terintegrasi dengan tema pengguna.

## [1.3.341] - 2026-07-07

### Changed
- **Default Browser Tab URL to Blank**:
  - Mengubah inisialisasi default URL pada tab browser dari `http://localhost:3000` menjadi kosong (`""`) di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) and [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx).
  - Menambahkan tampilan Welcome/Home View asli bernuansa t-line di dalam tab browser jika URL kosong, lengkap dengan panduan memulai server lokal dan tombol pintasan (preset) untuk port-port populer (`:3000`, `:5173`, `:8080`).

### Fixed
- **Dynamic Theme Color Integration on Offline Proxy Page**:
  - Menambahkan pendeteksi tema aktif (`tline-theme` & `tline-accent-color` dari localStorage) ke dalam halaman error offline proxy di [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts).
  - Halaman offline proxy sekarang otomatis menyesuaikan warna latar belakang, teks, kartu, border, dan aksen tombol dengan tema aktif pengguna (Dracula, Nord, Cyberpunk, Forest, Light Mode, dll.).

## [1.3.340] - 2026-07-07

### Added
- **Premium Web Preview Offline Home Page**:
  - Memperbarui halaman error 502/offline pada proxy server di [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts).
  - Mengubah tampilan peringatan error merah mentah menjadi halaman sambutan pratinjau web bergaya Obsidian/t-line yang premium, lengkap dengan ikon, panduan instruksi cara menyalakan server development lokal, dan tombol penyegaran koneksi yang elegan.

## [1.3.339] - 2026-07-07

### Fixed
- **Fix SyntaxError in Proxy Helper Script**:
  - Melakukan double-escape pada karakter slash regex (`/`) di [tline-helper-code.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/tline-helper-code.ts).
  - Ini mencegah pemrosesan template string menganggap karakter escape backslash (`\`) sebagai string escape normal, yang sebelumnya mereduksi regex `://` menjadi `//` sehingga memicu `Uncaught SyntaxError: Unexpected token 'var'` di browser dan menghentikan seluruh logika helper script (termasuk navigasi, pencatatan konsol, dan inspeksi elemen).

## [1.3.338] - 2026-07-07

### Changed
- **Restore Native Electron Webview Tag**:
  - Mengembalikan penggunaan tag `<webview>` native untuk lingkungan Electron di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx).
  - Ini memulihkan fungsi navigasi dan Developer Tools (inspect element) secara penuh dalam Electron, sementara lingkungan Tauri dan Web tetap menggunakan proxy iframe.

## [1.3.337] - 2026-07-07

### Fixed
- **Fix Element Inspection and Console Logging in Proxy Iframe**:
  - Menghapus atribut `sandbox` pada tag `iframe` di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx).
  - Ini mengatasi pembatasan keamanan Chromium/Electron yang memblokir komunikasi `postMessage` antar-jendela dan pembatasan cookie pada sandbox same-origin, memulihkan fungsi inspeksi elemen dan konsol error secara penuh saat menggunakan proxy.

## [1.3.336] - 2026-07-07

### Changed
- **Disable Native Webviews in Browser Tab**:
  - Menonaktifkan penggunaan tag `<webview>` bawaan Electron dan overlay `Webview` native Tauri di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx).
  - Mengarahkan pratinjau browser agar selalu menggunakan `iframe` via `preview-proxy` di semua platform (Electron, Tauri, dan Web), memberikan perilaku dan interoperabilitas pencarian/inspeksi elemen yang seragam.

## [1.3.335] - 2026-07-07

### Fixed
- **Fix Element Inspection and Error Capturing in Browser (Iframe Proxy)**:
  - Mengubah path script helper `tline-helper.js` dari relative ke absolute path `/api/preview-proxy/tline-helper.js` untuk mencegah konflik resolusi URL ketika target web app menggunakan tag `<base>` milik sendiri.
  - Memperbaiki pencocokan tag `<head>` pada server proxy di [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) dengan menggunakan regular expression case-insensitive yang mendukung atribut, serta menambahkan fallback ke tag `<html>` atau `<!doctype html>` sebelum menempelkan script ke awal berkas.
  - Menambahkan dukungan dekompresi otomatis (`gzip`, `deflate`, `br` via module `zlib`) untuk memproses respons HTML yang terkompresi dari server target sebelum dilakukan injeksi script helper.
  - Menambahkan pemeriksaan tipe element (`instanceof Element`) dan keberadaan properti (`tagName`, `classList`) pada event handler mouseover dan klik di [tline-helper-code.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/tline-helper-code.ts) guna mencegah eksekusi error saat pengguna mengeklik/menyorot objek teks, SVG, atau window/document.
- **Fix Webview Inspection (Tauri Dynamic Webview Overlay)**:
  - Menambahkan command Tauri Rust `open_webview_devtools` pada [lib.rs](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/src/lib.rs) untuk membuka Developer Tools dari dynamic webview target secara langsung di desktop.
  - Memperbarui navbar di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) agar merender tombol "Open DevTools" (yang memanggil command Rust tersebut) ketika preview dimuat menggunakan Tauri native webview, menggantikan tombol inspect element iframe biasa yang tidak berfungsi pada overlay native.

## [1.3.334] - 2026-07-07

### Fixed
- **Fix Webview Creation Timeout**:
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), menghapus logika *promise blocking* yang menunggu event `"tauri://created"` pada objek `Webview` anak dinamis, karena event tersebut tidak selalu dipancarkan oleh instance `Webview` di Tauri v2. Logika ini diganti dengan penundaan non-blokir singkat (150ms) dan pendengar galat `"tauri://error"` asinkron, mencegah kegagalan inisialisasi akibat timeout.

## [1.3.333] - 2026-07-07

### Added
- **Grant Webview Hide/Show Permissions in Capabilities**:
  - Menambahkan `"core:webview:allow-webview-hide"` dan `"core:webview:allow-webview-show"` ke list izin di [default.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/capabilities/default.json).
  - Tanpa izin ini, pemanggilan `.hide()` dan `.show()` pada Tauri dynamic Webview diblokir oleh sistem keamanan Tauri secara internal, sehingga menyebabkan webview Google/web pratinjau tetap muncul melayang di atas tab terminal atau berkas teks.

## [1.3.332] - 2026-07-07

### Fixed
- **Fix Native Webview Overlay Visibility Race Condition**:
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), menyinkronkan status visibilitas webview segera setelah inisialisasi/pembuatan selesai.
  - Ini mengatasi kondisi balapan (*race condition*) di mana pengguna berpindah ke tab lain (seperti terminal) saat webview sedang loading, yang menyebabkan efek visibilitas terlewati dan membuat webview native tetap muncul menimpa tab aktif lainnya.

## [1.3.331] - 2026-07-07

### Improved
- **Persist Browser Tabs State on Tab Switching**:
  - Di [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx), semua tab bertipe `browser` kini di-render sekaligus di dalam DOM dan disembunyikan/ditampilkan menggunakan properti `isActive` & inline CSS `display: flex/none` alih-alih di-unmount ketika tidak aktif. Hal ini mencegah browser tab memuat ulang/reload halamannya setiap kali berganti tab.
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), menambahkan efek visibility menggunakan `.show()` dan `.hide()` pada objek Tauri `Webview` untuk menyembunyikan/menampilkan child webview native ketika status tab aktif/tidak aktif, serta menjeda loop sinkronisasi bounds saat tab sedang tidak aktif.

## [1.3.330] - 2026-07-07

### Fixed
- **Fix Webview Navigation by Recreating on URL Change**:
  - Menghapus pemanggilan `.navigate()` pada instance `Webview` di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx). Di Tauri v2, kelas frontend `Webview` tidak mengekspor metode `.navigate()`, sehingga memicu `TypeError`.
  - Sekarang navigasi ditangani dengan menyertakan `activeUrl` ke dalam *dependency array* `useEffect` inisialisasi utama. Ketika URL pratinjau berubah, webview lama otomatis ditutup (*closed*) secara bersih dan webview baru dibuat dengan URL target yang baru.

## [1.3.329] - 2026-07-07

### Fixed
- **Revert Unstable Flag from tauri-build**:
  - Menghapus fitur `"unstable"` dari `tauri-build` di [Cargo.toml](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/Cargo.toml) karena `tauri-build` tidak memiliki opsi fitur tersebut dan memicu error kompilasi Cargo. Fitur `"unstable"` tetap dipertahankan pada dependensi `tauri` utama yang membutuhkannya.

## [1.3.328] - 2026-07-07

### Added
- **Enable Tauri Unstable Features in Cargo.toml**:
  - Menambahkan fitur `"unstable"` pada dependensi `tauri` dan `tauri-build` di [Cargo.toml](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/Cargo.toml).
  - Ini diperlukan karena API pembuatan webview anak secara dinamis (`new Webview(...)`) di Tauri v2 saat ini tergolong fitur tidak stabil (*unstable*) dan memicu pesan kesalahan: `"this feature requires the unstable flag on Cargo.toml"`.

## [1.3.327] - 2026-07-07

### Fixed
- **Fix Webview Bounds Sync Loop when Creation Fails**:
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), loop `updateLoop` bounds sync kini tidak akan berjalan jika inisialisasi Tauri native webview gagal atau mengalami timeout.
  - Sebelumnya, kegagalan pembuatan webview (misalnya akibat hilangnya izin atau ketidaktersediaan backend) tetap membuat loop bounds sync berjalan, sehingga memicu spam pesan error `Failed to sync webview bounds: webview not found`.

## [1.3.326] - 2026-07-07

### Fixed
- **Fix Webview Creation Permissions on Tauri (allow-create-webview)**:
  - Menambahkan permission `"core:webview:allow-create-webview"` dan `"core:webview:allow-webview-close"` di [default.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/capabilities/default.json) pada desktop-tauri capabilities.
  - Ini mengatasi kegagalan loading web preview external (seperti `google.com`) di tab Browser Preview pada lingkungan Tauri, yang sebelumnya gagal di-render karena frontend diblokir dari memanggil `new Webview(...)` secara dinamis.

## [1.3.325] - 2026-07-07

### Fixed
- **Fix useTauriWebview untuk Membaca activeUrl Alih-alih tab.url**:
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), variabel `useTauriWebview` diubah agar mendeteksi tipe URL dari `activeUrl` alih-alih `tab.url || activeUrl`.
  - Sebelumnya, `tab.url` tidak pernah diupdate ketika pengguna mengetik dan menavigasi ke URL baru (seperti `google.com`) di address bar. Hal ini membuat `useTauriWebview` tetap bernilai `false` (karena default tab.url adalah localhost yang merupakan local URL), sehingga memaksa mode Iframe/Proxy untuk URL eksternal yang kemudian diblokir oleh Google (karena X-Frame-Options/CSP).

## [1.3.324] - 2026-07-07

### Fixed
- **Fix Webview Label Conflict on Page Reload (F5 / Refresh)**:
  - Menyimpan label webview unik yang aktif dalam `sessionStorage` (yang dipertahankan selama refresh di tab browser yang sama).
  - Saat `BrowserTab` dimount/reload, ia membaca `sessionStorage` untuk menemukan label lama, mencari webview lama di backend Tauri dengan `Webview.getByLabel`, dan menutupnya.
  - Menambahkan delay/tunda 250ms setelah penutupan webview lama agar Tauri backend sempat menyelesaikan proses penutupan dan pelepasan label sebelum webview baru dibuat.
  - Menggunakan label webview acak yang unik (`inline-browser-webview-${tab.id}-${randomString}`) untuk menghindari tabrakan label di backend Tauri ketika webview baru dibuat.

## [1.3.323] - 2026-07-07

### Fixed
- **Fix Spurious Webview Bounds Sync Failures at Startup**:
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), kita kini mendengarkan event `tauri://created` dan `tauri://error` dari Tauri webview instance (dengan fallback timeout 500ms) untuk memastikan webview native telah benar-benar dibuat dan terdaftar sebelum memulai loop bounds sync (`updateLoop`).
  - Ini mengatasi transient error `"webview not found"` yang muncul saat mencoba menyinkronkan posisi/ukuran tepat setelah inisiasi sebelum webview Rust-side sepenuhnya siap, sehingga mencegah loop bounds sync terhenti sebelum waktunya.

## [1.3.322] - 2026-07-07

### Fixed
- **Fix Infinite Webview Bounds Sync Loop**:
  - Di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx), loop `updateLoop` bounds sync menggunakan `requestAnimationFrame` kini otomatis berhenti jika webview tidak lagi aktif/valid (`tauriWebviewRef.current !== webviewInstance`).
  - Menambahkan pembatasan peringatan (`console.warn`) hingga maksimal 5 kali berturut-turut, dan menghentikan loop sepenuhnya setelah 10 kegagalan beruntun untuk menghindari console spamming 60+ FPS dengan error "webview not found".
  - Di [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx), komponen `BrowserTab` kini diberikan properti `key={activeTab.id}` agar React melepas/unmount instance lama dan membuat yang baru saat berpindah tab.
  - Menambahkan `useEffect` reset state pada pergantian `tab.id` di `BrowserTab.tsx` untuk membersihkan logs, URL input, dan element inspection state demi keamanan agar data tidak bocor antartab.

## [1.3.314] - 2026-07-07

### Fixed
- **Fix URL Resolution Salah pada Navigasi JS dalam Proxy Browser**:
  - Root cause: Saat Google (atau SPA lain) menavigasi menggunakan URL relatif seperti `/search?q=...`, fungsi `proxyNavigateUrl` di helper script meresolve URL menggunakan `window.location.href` (yaitu `http://localhost:5773/api/preview-proxy`) sebagai base — sehingga origin salah menjadi `http://localhost:5773` dan proxy memanggil t-line sendiri.
  - **Fix 1 (server.ts):** Backend kini menginjeksikan `<script>window.__TLINE_PROXY_TARGET__="https://www.google.com";</script>` ke setiap halaman HTML yang diproxy, sehingga helper script selalu tahu origin target yang benar.
  - **Fix 2 (tline-helper-code.ts):** Fungsi `getProxyTarget()` membaca `window.__TLINE_PROXY_TARGET__` (atau fallback ke cookie) untuk digunakan sebagai base URL resolusi, memastikan `/search?q=...` di-resolve menjadi `https://www.google.com/search?q=...` bukan `http://localhost:5773/search?q=...`.
  - **Fix 3 (server.ts):** Query parameter `target=...` kini dihapus dari request yang diteruskan ke server target agar Google dan situs lain tidak bingung dengan parameter asing tersebut.

## [1.3.313] - 2026-07-07

### Added / Changed
- **Fix Navigasi JavaScript dalam Proxy Browser (Google Search & SPA)**:
  - Menambahkan interceptor navigasi berbasis JavaScript pada [tline-helper-code.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/tline-helper-code.ts) dengan meng-override `Location.prototype.href` setter, `location.assign()`, `location.replace()`, `history.pushState()`, dan `history.replaceState()` sehingga semua navigasi programatik (termasuk Google Search yang tidak menggunakan klik link biasa) tetap dialihkan melalui proxy backend.

## [1.3.312] - 2026-07-07

### Added / Changed
- **Peningkatan Proxy Browser Preview & Perubahan Default URL**:
  - Mengubah default URL saat membuka tab Browser Preview dari `https://www.google.com` ke `http://localhost:3000` di [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx) dan [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) agar pengguna langsung terarah ke preview aplikasi lokal yang sedang dikembangkan.
  - Menambahkan `secure: false` pada middleware proxy Express di [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) untuk mendukung proxy ke server lokal yang menggunakan HTTPS self-signed certificates.
  - Mengimplementasikan sanitasi dan penulisan ulang (*rewriting*) header `Location` untuk respon redirect (3xx) di backend proxy agar navigasi redirect tetap berada di dalam lingkup proxy (`/api/preview-proxy`).
  - Menambahkan interceptor navigasi klik link (`<a>`) dan pengiriman form (`<form>`) pada script helper ([tline-helper-code.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/tline-helper-code.ts)) untuk menangkap dan mengalihkan navigasi absolut/relatif agar tetap diproxy oleh backend.

## [1.3.311] - 2026-07-07

### Added / Changed
- **Fix Console Errors Capture (Electron & Iframe)**:
  - Mengubah cara `<webview>` di Electron didaftarkan *event listener* `console-message`-nya di [BrowserTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BrowserTab.tsx) dengan menggunakan Callback Ref State (`webviewEl`) alih-alih `webviewRef.current` di dependency array `useEffect`, memastikan listener sukses terpasang saat komponen dimount.
  - Menghapus atribut `defer` dari tag `<script src="tline-helper.js">` di proxy preview [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) agar script memblokir parsing dan dieksekusi sedini mungkin (sinkron), sehingga dapat menangkap error JavaScript yang terjadi pada saat load-time awal (sebelum DOM sepenuhnya termuat).

## [1.3.310] - 2026-07-07

### Added / Changed
- **Fix Element Inspection in Browser (Iframe Proxy)**:
  - Menambahkan route khusus `/api/preview-proxy/tline-helper.js` pada backend Express sebelum middleware proxy terdaftar untuk menyajikan script `tline-helper.js` secara langsung.
  - Memperbaiki bug di mana request helper script terserap oleh middleware `previewProxy` dan diteruskan ke aplikasi target, mengakibatkan error 404 status dan kegagalan fitur Element Inspection di browser.

## [1.3.309] - 2026-07-07

### Added / Changed
- **Integrasi Chromium Native Webview pada Electron & Fallback Proxy di Tauri/Web**:
  - Mengaktifkan tag `<webview>` di sisi Electron dengan menyetel `webviewTag: true` pada `webPreferences` (`desktop/main.js`).
  - Merender browser native Chromium (`<webview>`) di lingkungan Electron secara langsung menggunakan URL target tanpa melalui proxy, menjamin dukungan penuh bagi *cookies*, *login session*, dan bypass CORS 100%.
  - Memasang *event listener* `console-message` untuk menangkap error dari halaman tamu di dalam `<webview>` dan menampilkannya di drawer DevTools Obsidian.
  - Menambahkan tombol "Open DevTools" di navbar saat di dalam Electron untuk meluncurkan developer tools Chromium native bawaan.
  - Memelihara fallback otomatis menggunakan `iframe` dan reverse proxy backend untuk lingkungan non-Electron (seperti Tauri dan Web browser standar) agar fitur inspeksi elemen tetap berfungsi dengan baik.

## [1.3.308] - 2026-07-07

### Added / Changed
- **Resizable & Collapsible DevTools Drawer di Tab Browser**:
  - Menambahkan bar pengubah ukuran (*resize handle*) interaktif di atas panel DevTools sehingga tinggi panel dapat diatur dengan menyeret (*drag*) mouse.
  - Mematikan sementara *pointer events* pada *iframe* pratinjau ketika proses pengubahan ukuran sedang berlangsung untuk mencegah *lag* atau macet akibat tangkapan event oleh *iframe*.
  - Menambahkan tombol *collapse/expand* (toggle chevron) di pojok kanan atas *header* DevTools dan mendukung klik-ganda (*double-click*) pada *header* untuk menyembunyikan atau menampilkan panel DevTools dengan animasi transisi yang mulus.
  - Secara otomatis memperluas (*expand*) kembali panel DevTools ketika pengguna mengeklik tab *Console Errors* atau *Element Inspector* saat dalam kondisi tersembunyi.

## [1.3.307] - 2026-07-07

### Added / Changed
- **Fix Preview Helper Path**:
  - Mengubah pemanggilan `tline-helper.js` pada injektor proxy pratinjau di [server.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/server.ts) dari absolute path (`/tline-helper.js`) menjadi relative path (`tline-helper.js`) agar dapat di-resolve dengan benar menggunakan tag `<base href="/api/preview-proxy/">` di browser dan menghindari error status 404.

## [1.3.306] - 2026-07-07

### Added / Changed
- **Fix React SVG Warning**:
  - Mengubah properti SVG `stop-color` menjadi `stopColor` (camelCase) pada komponen [TPlusLogo.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TPlusLogo.tsx) untuk memperbaiki peringatan DOM tidak valid di konsol browser.

## [1.3.305] - 2026-07-07

### Added / Changed
- **Developer Browser Preview Tab dengan Error/Element Inspection & AI-Tagging (Option B)**:
  - Menambahkan tipe tab `browser` baru di frontend untuk pratinjau situs web lokal (default: `http://localhost:3000`).
  - Mengintegrasikan dynamic reverse proxy di backend Express (`/api/preview-proxy`) yang secara dinamis melayani aset, WebSocket HMR, dan menyuntikkan script helper (`tline-helper.js`).
  - Mendukung penyalinan instan prompt Markdown yang kaya konteks (pesan error console, detail struktur HTML elemen, class, Computed CSS) ke clipboard melalui tombol ✨ **Tag to AI** (Opsi B).
  - Menjamin kompatibilitas pratinjau jarak jauh (remote preview) dan inspeksi melalui Cloudflare Tunnel secara mulus.

## [1.3.304] - 2026-07-07

### Added / Changed
- **Pencegahan Crash xterm.js Viewport & Refactor TerminalInstance**:
  - Memperbaiki bug crash uncaught TypeError `Cannot read properties of undefined (reading 'dimensions')` pada method `syncScrollArea` dari class `Viewport` di xterm.js dengan melakukan monkey-patching try/catch secara dinamis setelah terminal dibuka (`term.open()`).
  - Merefaktor event handling mobile touch-to-mouse ke custom React hook [useTerminalTouchMapping.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminalTouchMapping.ts).
  - Mengurangi ukuran file [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) menjadi di bawah limit 1000 baris kode (sekarang 968 baris) untuk mematuhi standar arsitektur proyek.

## [1.3.303] - 2026-07-07

### Added / Changed
- **Penyembunyian Teks Tab Sidebar Saat Sempit (Dynamic Sidebar Tab Text Collapse)**:
  - Menyembunyikan teks label tab menu kiri (`Workspaces`, `Explorer`, `Changes`, `Snapshots`) secara dinamis jika lebar sidebar di-resize di bawah `280px` agar tampilan tetap bersih, tidak bertumpuk/terpotong.
  - Memosisikan lencana (badge) jumlah perubahan file Git secara melayang di atas icon `GitCompare` saat teks menu disembunyikan.

## [1.3.302] - 2026-07-07

### Added / Changed
- **Sinkronisasi Status Proses Aktif Global (Global WS Process/Title Sync)**:
  - Memperbaiki bug di mana mematikan proses agent (seperti `superagent`) atau mengubah judul shell saat tab terminal sedang tidak fokus (unmounted/suspended) menyebabkan status lencana (badges) pada sidebar tersangkut (stuck) dan tidak terupdate di frontend.
  - Menambahkan dukungan `globalMsgListeners` di `TerminalWebSocketManager` untuk menerima dan mendistribusikan event `activeProcesses` dan `title` secara terus menerus ke global React state `terminalInstances`, bahkan jika komponen visual terminal individual telah di-unmount dari DOM.

## [1.3.301] - 2026-07-07

### Added / Changed
- **Pembersihan Proses Anak Terminal (Recursive Process Tree Kill)**:
  - Memperbaiki kebocoran proses (process leak) di mana menutup tab terminal di UI tidak mematikan proses anak/descendant (seperti `node.exe` yang menjalankan `superagent`) pada Windows dan Unix.
  - Mengimplementasikan helper `killProcessTree` di [terminalManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/terminalManager.ts) yang menggunakan `taskkill /pid <PID> /f /t` pada Windows dan `pkill -P <PID>` pada Unix untuk secara rekursif mematikan seluruh pohon proses turunan saat sesi terminal di-kill.
  - Ini memastikan badge proses aktif dan status memori terupdate secara instan dan akurat ketika terminal ditutup atau di-reset.

## [1.3.300] - 2026-07-07

### Added / Changed
- **Peningkatan Fungsionalitas Desktop Tauri (Paritas Fitur Electron)**:
  - Mengintegrasikan System Tray Icon (Tray Icon) di Tauri v2 dengan menu dinamis yang sepenuhnya mereplikasi fungsionalitas Electron.
  - Menu tray kini secara dinamis menampilkan status backend, opsi toggle dashboard, kontrol penuh backend (Start, Stop, Restart), dan sub-menu berisi daftar sesi PTY terminal aktif yang dikelompokkan berdasarkan workspace (termasuk informasi branch git). Mengklik sesi PTY akan memfokuskan window utama.
  - Menambahkan *Close-to-Tray* dengan meng-intercept `WindowEvent::CloseRequested` untuk menyembunyikan window alih-alih keluar secara paksa, agar proses AI agent background tidak terhenti.
  - Mengintegrasikan Single Instance Lock menggunakan plugin `tauri-plugin-single-instance` di Tauri v2 untuk mencegah konflik port `5779` dan database.
  - Menambahkan validasi keberadaan Node.js pada saat startup dengan dialog peringatan native (cross-platform) jika Node.js belum terinstall.
  - Mengoptimalkan konfigurasi resources di `tauri.conf.json` agar hanya membundel folder produksi (`dist`) dan `node_modules` internal, memotong file sampah workspace dan meminimalkan ukuran installer akhir.

## [1.3.299] - 2026-07-07

### Added / Changed
- **Icon Close & Window Controls Desktop Tauri**:
  - Menambahkan controls window (Minimize, Maximize/Restore, Close) untuk desktop berbasis Tauri v2 di frontend [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx).
  - Menyambungkan window controls ke API window Tauri v2 (`getCurrentWindow`) via objek global `window.__TAURI__.window`.
  - Menambahkan attribute `data-tauri-drag-region` pada topbar dan sidebar header di [App.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx) agar window bisa di-drag dengan normal.
  - Membuka permission window controls (`core:window:default`, `core:window:allow-close`, `core:window:allow-minimize`, `core:window:allow-toggle-maximize`, `core:window:allow-start-dragging`) di file capability [default.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/capabilities/default.json).

## [1.3.298] - 2026-07-07

### Added / Changed
- **Pemisahan Perhitungan Memori Backend dan Desktop di Tauri**:
  - Mengabaikan (exclude) PID proses backend Node.js dari penjumlahan memori proses anak di Tauri Command `get_memory_usage`.
  - Ini mencegah memori backend dihitung dua kali (di B: dan D:) di footer, sehingga status memori D: benar-benar menunjukkan memori shell desktop murni (~56MB) secara akurat.

## [1.3.297] - 2026-07-07

### Added / Changed
- **Optimasi Tambahan RAM Backend Node.js di Tauri**:
  - Mengonfigurasi Rust process launcher untuk menyuntikkan flag optimasi V8 (`--max-old-space-size=64` dan `--expose-gc`) saat meluncurkan Node.js.
  - Ini mengaktifkan fitur garbage collection periodik bawaan di backend dan membatasi ukuran heap maks ke 64MB, memotong penggunaan memori backend secara drastis dari ~60MB menjadi ~25MB-35MB.

## [1.3.296] - 2026-07-07

### Added / Changed
- **Migrasi Desktop Wrapper ke Tauri v2 untuk Optimasi RAM (<100MB)**:
  - Membuat sub-workspace baru [desktop-tauri](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri) sebagai wrapper desktop alternatif berbasis Tauri v2 untuk memangkas penggunaan memori RAM hingga di bawah 100MB (gabungan proses frontend & backend).
  - Mengimplementasikan Rust launcher di [lib.rs](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/src-tauri/src/lib.rs) untuk meluncurkan backend Node.js, memantau kesiapan server melalui TCP polling port `5779`, mem-bypass auth token ke webview, dan mematikan proses backend secara otomatis menggunakan `taskkill` di Windows pada saat keluar.
  - Menambahkan skrip [copy-assets.js](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop-tauri/copy-assets.js) untuk bundling otomatis dan menyusun dependensi `node_modules` lokal produksi agar terkemas sebagai bundle resources Tauri.
  - Menambahkan perintah pintasan `npm run tauri` dan `npm run build:tauri` pada root [package.json](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/package.json).
  - Menambahkan Rust command `get_memory_usage` (menggunakan crate `sysinfo`) dan menghubungkannya ke hook [useSystemStats.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useSystemStats.ts) via `window.__TAURI__.core.invoke` untuk menampilkan info penggunaan RAM gabungan Tauri di footer secara real-time.

## [1.3.295] - 2026-07-07

### Added / Changed
- **Penyederhanaan Tampilan Lencana Proses Aktif (Process Badges)**:
  - Menyederhanakan tampilan lencana proses aktif seperti Superagent, Claude, Gemini, Cursor, Agy, dan OpenCode pada daftar workspace/worktree di sidebar.
  - Menghilangkan efek animasi denyut (pulse animation), efek bayangan bercahaya (glow/box-shadow), gradasi warna, dan border.
  - Mengubah latar belakang lencana menjadi warna solid yang datar (flat solid background) dengan kontras tinggi agar tetap terlihat mencolok namun bersih dan simpel.

## [1.3.294] - 2026-07-07

### Added / Changed
- **Perbaikan Pembajakan Fokus Tab Terminal oleh Terminal Grid (Tab Focus Hijacking)**:
  - Memperbaiki bug di mana mengklik tab terminal tunggal (dedicated terminal) malah memaksa layar berpindah kembali ke tab Terminal Grid (jika terminal tersebut juga terdaftar di grid).
  - Masalah ini terjadi karena `focusTerminal` di [useTerminals.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminals.ts) secara naif memicu `setActiveTabId` untuk setiap tab yang berisi terminal tersebut (baik tipe `'terminal'` maupun `'grid'`), sehingga tab terakhir yang diproses (biasanya grid) membajak fokus.
  - Memperbaiki penanganan dengan memeriksa apakah tab aktif saat ini (`activeTabId`) sudah memuat terminal tersebut; jika ya, fokus tab tetap dipertahankan. Jika tidak, ia akan memilih tab terbaik secara sekuensial (memprioritaskan tab terminal berdedikasi sebelum tab grid).

## [1.3.293] - 2026-07-07

### Added / Changed
- **Dukungan Deteksi Khusus AI Agent Tambahan (Agy & OpenCode)**:
  - Menambahkan deteksi proses khusus dan visualisasi badge untuk AI agent **Agy** dan **OpenCode** (termasuk variasi keyword `open-code` dan `opencode`).
  - Memperbarui interface data `ActiveProcessSummary` di sisi backend ([terminalManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/terminalManager.ts)) dan frontend ([useTerminals.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminals.ts)).
  - Mengintegrasikan styling badge khusus untuk Agy (emerald/green) dan OpenCode (indigo) di sidebar daftar workspace dan worktree ([WorkspaceList.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/WorkspaceList.tsx)) serta file CSS ([components.css](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/components.css)).
  - Menyempurnakan fallback badge "Active" agar tidak bentrok atau muncul berlebih saat AI agent baru tersebut sedang berjalan.

## [1.3.292] - 2026-07-07

### Added / Changed
- **Perbaikan Deteksi Proses Aktif Terminal (Windows CRCRLF wmic parse)**:
  - Memperbaiki parsing CSV output dari perintah `wmic` di [terminalManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/terminalManager.ts) pada sistem Windows.
  - Pada Windows, `wmic` sering mengembalikan carriage return berlipat (`\r\r\n`). Hal ini merusak pembacaan header CSV jika hanya di-split menggunakan regex `\r?\n`, menyebabkan header terbaca sebagai `\r` kosong dan seluruh baris anak proses gagal diurai (menjadi `NaN` / `undefined`).
  - Memperbaiki kode dengan cara membersihkan seluruh karakter `\r` terlebih dahulu sebelum melakukan split baris, memastikan proses anak (seperti `superagent` atau `node.exe`) di bawah shell PTY terdeteksi dengan benar dan tidak menampilkan status "idle" secara keliru.

## [1.3.291] - 2026-07-07

### Added / Changed
- **Penyelarasan Sinkronisasi Ukuran Awal Terminal (Initial Fit)**:
  - Mengubah inisialisasi xterm.js di [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) agar memicu `fitAddon.fit()` secara sinkron segera setelah terminal dibuka.
  - Ini memastikan dimensi kolom dan baris yang sebenarnya dari container terhitung dengan tepat sebelum koneksi WebSocket mengirimkan pesan `init`.
  - Mencegah masalah di mana PTY shell dan aplikasi interaktif di dalamnya (seperti `superagent` berbasis Ink) dimulai dengan dimensi default `80x24` yang menyebabkan UI terpotong di pojok dan mengharuskan user me-refresh terminal secara manual.

## [1.3.290] - 2026-07-07

### Added / Changed
- **Perbaikan Interupsi Mouse Tracking / Scroll & Click Terminal**:
  - Mengatasi bug pada [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) di mana scroll wheel dan mouse click pada aplikasi yang menggunakan *Mouse Reporting* (seperti `superagent` atau `claudecode`) tidak berfungsi (macet).
  - Penyebabnya adalah pemanggilan programmatic `.focus()` dan `.textarea.focus()` yang berlebihan di phase capture (`handleFocusTrigger`) dan bubble (`handleTerminalFocus`) pada setiap event click/mousedown, yang menginterupsi pointer capture/propagation dari xterm.js ke shell PTY.
  - Memperbaiki penanganan dengan mendeteksi status fokus aktif (`document.activeElement`) sebelum memicu `focus()`, sehingga event mouse/scroll diteruskan dengan lancar dan utuh tanpa distorsi.

## [1.3.288] - 2026-07-06

### Added / Changed
- **Perbaikan Keyboard Shortcut Terminal (Ctrl+C / Copy & Interrupt) dan Refaktorisasi Kode**:
  - **Penghindaran Intersepsi Shortcut Electron**: Memodifikasi pembuatan menu aplikasi di [main.js](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/desktop/main.js) agar Edit menu (dengan shortcut copy/paste default role) hanya dipasang pada macOS. Pada Windows/Linux, menu ini dilewati sehingga Electron tidak mencegat penekanan tombol `Ctrl+C` dan `Ctrl+V` secara global di tingkat window. Ini mengembalikan kemampuan terminal untuk menerima input `Ctrl+C` (untuk membatalkan/menghentikan perintah aktif) secara langsung.
  - **Dukungan Copy Cerdas Renderer**: Memperbarui penanganan tombol keyboard di [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) agar mendukung `Ctrl+C` (Windows/Linux) dan `Cmd+C` (macOS) secara cerdas: jika ada teks yang diseleksi di terminal, shortcut tersebut akan menyalin teks ke clipboard, sedangkan jika tidak ada teks yang diseleksi, `Ctrl+C` akan dikirimkan ke PTY shell untuk interupsi proses (SIGINT).
  - **Utilitas Clipboard Robust**: Menambahkan helper `copyToClipboard` di [TerminalHelpers.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalHelpers.ts) yang mendeteksi ketersediaan `navigator.clipboard` dalam konteks aman (secure context), dengan fallback otomatis menggunakan seleksi elemen `textarea` tiruan dan `document.execCommand('copy')` agar fungsi Copy tetap bekerja di semua konteks HTTP non-aman.
  - **Refaktorisasi Batas File 1000 Baris**: Memindahkan berbagai tipe data, fungsi helper penilai warna/kondisi, detektor mobile, dan pembuat tema terminal dari `TerminalInstance.tsx` ke file helper baru [TerminalHelpers.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalHelpers.ts). Tindakan ini sukses memangkas baris kode `TerminalInstance.tsx` dari **1128** baris menjadi **996** baris, memenuhi aturan ketat basis kode (di bawah 1000 baris).

## [1.3.287] - 2026-07-04

### Added / Changed
- **Perbaikan Pembatalan Timer & Eksekusi Otomatis Perintah Panjang (Orbit & Command Lainnya)**:
  - Memperbaiki penguncian eksekusi perintah di [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx). Sebelumnya, saat PTY memancarkan data secara berkelanjutan (misal output git/profil prompt), `clearTimeout` dipanggil terus-menerus sehingga perintah panjang seperti `.\orbit.exe dashboard --full` dibatalkan berulang kali.
  - Setelah prompt siap terdeteksi (`isPromptReady`), eksekusi dikunci (*locked*) dan dipicu dalam `150ms` tanpa bisa dibatalkan oleh sinyal PTY data berikutnya, menjamin seluruh pintasan Quick Launch berjalan konsisten.

## [1.3.286] - 2026-07-04

### Added / Changed
- **Sinkronisasi Deteksi Prompt Asinkron xterm.js**:
  - Mengatasi masalah di mana pendeteksian prompt asinkron di [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) gagal (karena xterm.js melakukan antrean penulisan buffer secara asinkron menggunakan requestAnimationFrame, sedangkan pembacaan status prompt terjadi seketika di waktu penerimaan paket data WebSocket).
  - Menunda pengecekan prompt kesiapan buffer terminal sebanyak `50ms` (menggunakan debounced timeout) agar xterm.js selesai memproses dan menggambar prompt di buffer, sehingga eksekusi perintah otomatis seperti `bun run dev` dan `.\orbit.exe dashboard --full` kembali berjalan secara langsung dan andal tanpa harus menunggu fallback delay 1.5 detik.

## [1.3.285] - 2026-07-04

### Added / Changed
- **Penyelesaian Auto-Run Command Lambat & Perbaikan Detektor Electron**:
  - **Detektor Prompt Cerdas (isPromptReady)**: Menambahkan utilitas pendeteksi kesiapan prompt xterm.js di [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx). Jika prompt terminal aktif dideteksi siap (`>`, `$`, `%`, `#`), penundaan auto-run dipersingkat menjadi 300ms. Jika belum siap (sedang menjalankan posh-git/starship/pemuatan profil startup lambat), delay disesuaikan secara dinamis hingga 1500ms dari keheningan aliran data PTY.
  - **Pengecualian Detektor Remote Electron**: Memperbarui penentu koneksi remote `isRemoteConnection()` agar mengecualikan desktop app (Electron) yang menggunakan skema `file:`, hostname kosong, or agent Electron, sehingga fitur auto-suspend 5-menit tidak aktif pada aplikasi desktop lokal.

## [1.3.284] - 2026-07-04

### Added / Changed
- **Penyelesaian Masalah Eksekusi Perintah Awal Terminal (Quick Launch)**:
  - Meningkatkan stabilitas auto-run *Quick Launch* dengan memperpanjang `SILENCE_MS` dari 300ms ke 1000ms dan `FALLBACK_MS` dari 4s ke 6s di [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx). Hal ini mencegah pemotongan/swallowing perintah saat shell (seperti PowerShell atau Bash) sedang melakukan pemuatan lambat profil startup.
  - Memperbaiki pengiriman properti `clearInitialCommand` pada child components di [SplitLayoutRenderer.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SplitLayoutRenderer.tsx) agar status perintah awal tersapu bersih dengan tepat di semua layout pane (termasuk layout split/grid).

## [1.3.283] - 2026-07-04

### Added / Changed
- **Peningkatan Sinkronisasi Dimensi & Manajemen Daya/Bandwidth Terminal**:
  - **Broadcast Resize Terminal**: Backend memancarkan event `resize_broadcast` ke seluruh klien tersambung lainnya ketika sebuah klien melakukan resize dimensi terminal. Ditambah proteksi loop pencocokan dimensi di backend agar terhindar dari pemanggilan resize berantai tak berujung.
  - **Exponential Backoff Reconnect**: Mengubah sistem coba-koneksi-kembali WebSocket yang sebelumnya bernilai statis 3s menjadi jeda eksponensial (berkembang dari 1.5s s/d maksimal 15s) untuk meringankan load server dan menstabilkan reconnect saat offline.
  - **Auto-Suspend Terminal Inaktif di Koneksi Remote**: Menerapkan detektor koneksi remote (bukan localhost). Bila koneksi terdeteksi remote dan tidak ada input/output selama 5 menit, terminal akan disuspensi secara otomatis (memutuskan aliran WebSocket dan merilis listener untuk menghemat kuota data & daya baterai) dengan visualisasi overlay buram dan tombol "Click to Resume" yang mulus.

## [1.3.282] - 2026-07-04

### Added / Changed
- **Multiplexing Terminal dan Sinkronisasi Sesi Multi-klien**:
  - Mengubah penanganan PTY session di `TerminalManager` agar mendukung beberapa WebSocket senders dan exit callbacks sekaligus (menggunakan `Map` berbasis key socket unik `ws`).
  - Mencegah masalah di mana sesi terminal terputus atau tidak tersinkronisasi outputnya (beku/freeze) ketika diakses secara bersamaan lewat remote tunnel (seperti HP/tablet) dan aplikasi desktop lokal.
  - Memastikan event `suspend` atau penutupan koneksi satu klien tidak menghentikan sesi terminal yang masih memiliki koneksi aktif dari klien lain.

## [1.3.281] - 2026-07-04

### Added / Changed
- **Penyelesaian Loop Rekursif & Masalah Spasi Path Bun Run Dev**:
  - Membuat script runner `dev.js` terpadu di root project yang mendeteksi runtime (`bun` vs `npm`) dan mengeksekusi workspace backend dan frontend dengan aman tanpa memicu loop penafsiran ulang/intersepsi perintah bun di Windows.
- **Normalisasi Baris Baru (Newline) pada Terminal Fallback (SpawnTerminal)**:
  - Mengonversi carriage return (`\r`) menjadi newline platform yang sesuai (`\r\n` di Windows, `\n` di POSIX) saat menulis input ke standard input child process di mode terminal fallback (`SpawnTerminal`).
  - Menghilangkan bug di mana pintasan *Quick Launch* (seperti `bun run dev`) atau input ketukan Enter tidak merespon/macet di terminal fallback ketika `node-pty` gagal dimuat di bawah bun.

## [1.3.280] - 2026-07-04

### Added / Changed
- **Scroll to Bottom di Footer Terminal**:
  - Menambahkan tombol "Scroll to bottom" (dengan ikon `ChevronDown`) pada footer utama aplikasi saat tab bertipe `terminal` atau `grid` aktif.
  - Mengimplementasikan listener event `tline-scroll-to-bottom` di [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx) yang secara dinamis memicu fungsi `scrollToBottom()` bawaan xterm.js pada terminal instance yang sedang aktif.
  - Memperbarui `focusTerminal` di [useTerminals.ts](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminals.ts) dan properti `onFocus` pada terminal grid di [TerminalGridTab.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalGridTab.tsx) agar status terminal terfokus dapat dilacak dengan presisi baik di tab biasa maupun grid.

## [1.3.279] - 2026-07-04

### Added / Changed
- **Peta Klik Presisi Terminal & Pemetaan Sentuhan ke Mouse (Mobile/Tablet)**:
  - Mengimplementasikan pendeteksi ketukan (tap) menggunakan `touchstart` dan `touchend` di dalam container terminal xterm.js pada [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx).
  - Mengonversi tap layar tersebut menjadi event mouse virtual (`mousedown`, `mouseup`, `click`) di koordinat tepat sentuhan dan mengirimkannya langsung ke elemen target xterm.js.
  - Memperbaiki dukungan interaksi CLI interaktif (seperti Claude Code, agy, micro editor, atau tombol expand) agar bisa diklik sesuai dengan posisinya di layar sentuh, sekaligus mempertahankan fungsi *suppress* keyboard native dan auto-open keyboard virtual bawaan tline.

## [1.3.278] - 2026-07-04

### Added / Changed
- **Isolasi Quick Launch per Project/Workspace**:
  - Menyaring daftar pintasan Quick Launch baik di dropdown desktop maupun di sidebar mobile secara dinamis berdasarkan workspace terfokus saat ini (`panelWorkspace.path`).
  - Menampilkan nama workspace di judul dropdown Quick Launch untuk memperjelas konteks proyek yang sedang aktif.

## [1.3.277] - 2026-07-04

### Added / Changed
- **Sinkronisasi Tab Real-time via WebSocket**:
  - Mengintegrasikan penyiaran (broadcast) perubahan state sinkronisasi terpusat ke semua klien WebSocket yang sedang terhubung dari backend saat menerima pembaruan state.
  - Menambahkan langganan (subscription) event `sync_update` pada sisi frontend menggunakan WebSocket manager agar tab baru, tab ditutup, file yang dibuka, maupun perubahan Quick Launch di mobile langsung terbuka/diperbarui secara real-time di desktop secara instan tanpa perlu memuat ulang halaman (refreshed).

## [1.3.276] - 2026-07-04

### Added / Changed
- **Sinkronisasi Tab Aktif & Quick Launch Terpusat**:
  - Menambahkan endpoint REST API di backend (`/api/sync/state`) untuk menyimpan dan membaca data tab aktif, saved prompts (Quick Launch), dan informasi instance terminal.
  - Mengintegrasikan mekanisme fetch saat login/start dan debounced auto-upload di frontend, sehingga tab dan pintasan Quick Launch tersinkronisasi secara real-time antar perangkat (desktop & mobile).
- **Perbaikan Responsivitas Terminal Grid di Mobile**:
  - Memperbaiki tata letak terminal grid agar mengecil secara dinamis menggunakan formula `min(100%, cardWidth)` untuk mencegah overflow dan menumpuk secara vertikal (vertical stack) dengan rapi pada layar mobile/tablet.

## [1.3.275] - 2026-07-04

### Added / Changed
- **Dukungan Shortcut Help dan Quick Launch di Mobile/Tablet**:
  - Menambahkan menu Keyboard Shortcuts (info shortcut) ke dalam RightSidebar untuk pengguna perangkat seluler/tablet.
  - Menambahkan menu dan fungsionalitas Quick Launch ke dalam RightSidebar sehingga pintasan perintah/prompt tersimpan dapat dijalankan, dihapus, dan ditambahkan dari perangkat mobile/tablet.

## [1.3.274] - 2026-07-04

### Added / Changed
- **Peningkatan Visual Indikator Penghapusan & Proses Aktif Worktree**:
  - Memperbaiki animasi loading penghapusan worktree (`Removing...`) agar ter-nesting dengan indah di tingkat direktori child, mempertahankan tajuk branch tetap terlihat.
  - Memasukkan kembali indikator proses aktif (dot warna hijau) yang menempel pada ikon `FolderOpen` untuk worktree yang sedang memiliki terminal aktif.

## [1.3.273] - 2026-07-04

### Added / Changed
- **Struktur Hirarki Branch dan Worktree (Menjorok)**:
  - Menyusun visualisasi branch Git dan worktree menjadi berjenjang (nested).
  - Branch ditampilkan sebagai entitas induk (parent) dengan ikon `GitBranch`.
  - Jika branch tersebut memiliki direktori worktree fisik, direktori tersebut akan ditampilkan di bawahnya (child) menjorok ke dalam (`margin-left: 32px`) menggunakan ikon `FolderOpen` dan path relatif yang ringkas.
  - Memindahkan indikator proses aktif (seperti Claude, Gemini, Cursor) dan tombol tindakan (Terminal, Hapus) ke baris direktori worktree fisik agar sesuai konteks operasionalnya.

## [1.3.272] - 2026-07-04

### Added / Changed
- **Dukungan Tampilan Semua Branch Git & Integrasi Checkout**:
  - Menampilkan semua branch Git lokal di sidebar explorer, bahkan untuk branch yang belum didaftarkan sebagai worktree (ditandai dengan badge `git` abu-abu).
  - Mengklik branch non-worktree akan memicu dialog konfirmasi switch branch untuk melakukan checkout branch tersebut di dalam direktori workspace utama.
  - Untuk branch yang telah terdaftar sebagai worktree, perilaku tetap sama (fokus langsung ke direktori worktree bersangkutan tanpa dialog konfirmasi).

## [1.3.271] - 2026-07-04

### Changed
- **Bypass Konfirmasi Perpindahan Worktree & Proteksi Checkout Branch**:
  - Menghapus modal konfirmasi (`showConfirm`) saat berpindah direktori worktree di panel samping pada [useWorkspaceHandlers.ts](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useWorkspaceHandlers.ts). Perpindahan fokus antar-folder worktree kini berjalan instan.
  - Memindahkan dialog konfirmasi ke aksi pemindahan/checkout branch aktif pada worktree/workspace di dalam [BranchModal.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/BranchModal.tsx) dengan meluncurkan prompt Switch/Cancel inline untuk mencegah checkout yang tidak diinginkan.

## [1.3.270] - 2026-07-04

### Changed
- **Bypass Konfirmasi untuk Perpindahan Workspace**:
  - Menghapus modal konfirmasi (`showConfirm`) saat pengguna berpindah workspace langsung dari header repositori pada [useWorkspaceHandlers.ts](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useWorkspaceHandlers.ts). Perpindahan antar-workspace kini berjalan instan tanpa dialog.
  - Tetap mempertahankan modal konfirmasi untuk perpindahan antar branch/worktree di bawah workspace yang bersangkutan.

## [1.3.269] - 2026-07-04

### Changed / Added
- **Optimasi Tampilan Branch Terfokus pada Workspace Non-Aktif**:
  - Mengubah logika list worktree pada [WorkspaceList.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/WorkspaceList.tsx) agar tetap menampilkan branch/worktree yang sedang terfokus (aktif) pada workspace non-aktif, alih-alih menyembunyikannya secara total.
  - Untuk workspace yang sedang tidak difokuskan secara global, list branch-nya disaring hanya menampilkan 1 item branch yang aktif di workspace tersebut, sementara branch-branch lain yang tidak aktif pada workspace tersebut disembunyikan.
  - Untuk workspace yang sedang aktif secara global, semua branch/worktree tetap ditampilkan secara penuh dengan opsi expand/collapse toggle.

## [1.3.268] - 2026-07-04

### Changed / Added
- **Peningkatan Visual Indentasi & Fokus Workspace / Worktree**:
  - Memperlebar indentasi visual daftar worktree di panel samping dari `20px` menjadi `32px` serta menyesuaikan posisi garis putus-putus (`tree-connector`) agar struktur pohon lebih menjorok dan terlihat jelas di [components.css](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/components.css).
  - Menyembunyikan daftar worktree untuk workspace yang sedang tidak aktif di [WorkspaceList.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/WorkspaceList.tsx) agar hanya branch/worktree dari workspace fokus yang ditampilkan.
  - Menerapkan efek visual redup/gelap (`.ws-card-dimmed`) pada workspace card yang tidak aktif untuk mengarahkan fokus pengguna ke workspace/branch yang sedang dibuka.
  - Menambahkan modal dialog konfirmasi sebelum berpindah workspace atau worktree branch aktif pada [useWorkspaceHandlers.ts](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useWorkspaceHandlers.ts) untuk mencegah kesalahan klik/pindah fokus yang tidak disengaja.

## [1.3.267] - 2026-07-04

### Changed / Added
- **Suppress Native Keyboard & Auto-Open t-line Keyboard**:
  - Menonaktifkan keyboard native bawaan pada perangkat mobile/tablet saat terminal diklik atau difokuskan dengan mengatur `inputmode="none"` pada xterm textarea di [TerminalInstance.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx).
  - Mengirimkan custom event `tline-terminal-focus` dari terminal ke container window saat terminal difokuskan di perangkat mobile/tablet.
  - Menangkap custom event `tline-terminal-focus` pada [App.tsx](file:///D:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx) untuk secara otomatis membuka/menampilkan keyboard virtual `t-line` bawaan aplikasi demi pengalaman mengetik mobile yang mulus.

## [1.3.266] - 2026-07-03

### Fixed
- **Quick Launch Reliability (Silence-Detection)**:
  - Mengganti delay statis 600ms saat mengirim perintah dari Quick Launch shortcut dengan algoritma **silence-detection** yang lebih andal di [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx).
  - Sebelumnya, jika proses startup shell (misalnya PowerShell profile) memerlukan waktu lebih dari 600ms, perintah shortcut dikirim terlalu dini dan "hilang" atau tidak tereksekusi sama sekali — menyebabkan fitur Quick Launch kadang berhasil kadang tidak.
  - Sekarang, sistem mendengarkan output stream PTY: setiap kali terminal mengeluarkan data, timer 300ms direset. Perintah baru dikirim setelah output terhenti selama 300ms (tanda prompt siap). Terdapat fallback otomatis 4 detik untuk shell yang tidak mengeluarkan output sama sekali.

## [1.3.265] - 2026-07-03

### Improved / Optimized
- **PTY Active Process Polling CPU Optimization**:
  - Mengubah metode pendeteksian proses aktif terminal di backend ([terminalManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/terminalManager.ts#L505)). Sebelumnya, backend secara konstan memanggil `wmic` secara global untuk mengambil seluruh daftar proses sistem operasi setiap 5 detik (sangat membebani CPU Windows & menyebabkan terminal terasa lambat/berat).
  - Sekarang, pencarian proses aktif dioptimalkan secara drastis dengan menargetkan query WMI/ps secara rekursif hanya untuk PID shell yang bersangkutan beserta keturunannya (`ParentProcessId=shellPid`).
  - Menambahkan sistem caching berdurasi 4 detik untuk ringkasan proses aktif per shell PID guna meminimalkan redundant query saat beberapa tab atau split-pane terminal dibuka bersamaan. Hal ini memangkas penggunaan CPU di latar belakang hingga mendekati 0% dan membuat responsivitas terminal jauh lebih ringan.

## [1.3.264] - 2026-07-03

### Fixed
- **Double Caret (Cursor) in Terminal & Focus Interception**:
  - Membatasi CSS positioning `.xterm-helper-textarea` ke perangkat mobile/tablet (layar sentuh / lebar <= 1024px) menggunakan media query `@media (pointer: coarse) or (max-width: 1024px)` pada [layout.css](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/layout.css#L565). Hal ini menghilangkan caret/kursor kedip kedua (double caret) di pojok bawah/kiri terminal pada browser desktop.
  - Mengubah listener event penanganan fokus terminal pada [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx#L527) dan wrapper pane dari event `click` menjadi event `mousedown` pada fase capture (`true`). Hal ini mencegah aplikasi dalam terminal yang mengaktifkan deteksi mouse (seperti `claudecode` atau `superagent`) menangkap (intercept) dan mematikan (eat) event klik, sehingga terminal tetap dapat difokuskan dengan normal saat diklik.

## [1.3.263] - 2026-07-02

### Fixed
- **Restore Workspace Path & Git Branch Pill in Mobile/Tablet Footer**:
  - Memisahkan elemen konteks workspace (nama folder + badge Git Branch aktif) dari blok tombol Zoom & Shell pada [Footer.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/Footer.tsx#L287).
  - Memastikan nama workspace ([Folder] `fassst-manager`) dan pill branch aktif ([GitBranch] `master`) **selalu tampil** di Footer pada semua ukuran layar (mobile, tablet, maupun desktop), sementara hanya kontrol Zoom, Shell Selector, dan Cloudflare Tunnel yang disembunyikan di tampilan mobile/tablet.

## [1.3.262] - 2026-07-02

### Changed
- **Hide Duplicated Footer Controls on Mobile & Tablet (`<= 1024px`)**:
  - Mengubah breakpoint responsif kontrol tengah (Zoom in/out font, selector default shell, tombol restart terminal) dan kontrol kanan (Cloudflare Tunnel status, URL, tombol start Quick/Custom & Stop) pada [Footer.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/Footer.tsx#L288) dari `hidden sm:flex` / `hidden md:flex` menjadi **`hidden lg:flex`**.
  - Kontrol-kontrol tersebut kini disembunyikan dari Footer pada tampilan Mobile & Tablet (`<= 1024px`) agar footer tidak berantakan/berlapis, karena semua fungsi tersebut sudah tersedia lengkap pada Menu Kanan ([RightSidebar.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/RightSidebar.tsx#L167)).

## [1.3.261] - 2026-07-02

### Fixed
- **Fixed Mobile & Tablet Terminal Keyboard Popup**:
  - Menghapus pengecekan kondisional `!insideXterm` pada [TerminalInstance.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx#L510) agar sentuhan/tap langsung di area canvas terminal pada perangkat mobile & tablet selalu memicu `textarea.focus()`.
  - Mengatur atribut `inputmode="text"`, `autocorrect="off"`, dan `autocapitalize="none"` pada textarea xterm.
  - Menambahkan aturan CSS `.xterm-helper-textarea` di [layout.css](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/layout.css#L564) agar textarea terposisi secara valid di dalam viewport dengan ukuran non-zero, memaksa browser mobile (iOS Safari & Android Chrome) menampilkan soft keyboard bawaan saat area terminal di-tap.

## [1.3.260] - 2026-07-02

### Added / Fixed
- **Enabled Monaco Editor Word Wrap & Fixed Mobile File Header Layout**:
  - Mengaktifkan fitur Word Wrap (`wordWrap: 'on'`) pada Monaco Editor di [FileViewerTab.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/FileViewerTab.tsx#L623) agar kode/teks panjang otomatis terpotong rapi ke baris berikutnya di layar mobile tanpa perlu scroll horizontal.
  - Memperbaiki layout flex header file viewer agar label status (`Auto-save active`, `Saved`, `Modified`) tidak tertekan atau terlipat secara vertikal (`whitespace-nowrap shrink-0`) di layar sentuh/mobile yang sempit.

## [1.3.259] - 2026-07-02

### Changed
- **Lower Minimum Terminal Font Size to 5px**: Menurunkan batas minimum font size terminal dari `8px` menjadi **`5px`**.
  - Diperbarui pada handler zoom out ([useTerminals.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/hooks/useTerminals.ts#L253)) serta slider range input pada modal pengaturan ([SettingsModal.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SettingsModal.tsx#L546)).

## [1.3.258] - 2026-07-02

### Fixed
- **Fixed Mobile/Tablet New Tab Button Position**: Memisahkan tombol tambah terminal (`+` / `.mobile-tab-new`) dari container scroll tab ([.mobile-tab-bar](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/layout.css#L546)) pada tampilan header mobile & tablet (`<= 768px`).
  - Menggunakan wrapper [.mobile-tab-wrapper](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/layout.css#L536) agar tombol `+` tetap **fixed / pinned** di posisi kanan dan tidak ikut tergeser saat daftar tab di-scroll secara horizontal.

## [1.3.257] - 2026-07-02

### Fixed
- **Strict Mobile Font Size Enforcement**: Memastikan [TerminalInstance](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalInstance.tsx#L221) di perangkat mobile/tablet selalu menerapkan **`9px`** secara langsung saat halaman direfresh/dibuka, mengabaikan nilai prop font desktop lama dari memori browser.

## [1.3.256] - 2026-07-02

### Fixed
- **Mobile Terminal Font Size Isolation**: Memisahkan kunci penyimpanan `localStorage` font size antara desktop (`tline-terminal-font-size-v2`) dan mobile/tablet (`tline-mobile-font-size`).
  - **Penyebab font masih 12px**: Sebelumnya browser menyimpan nilai 12px dari sesi desktop lama di key `tline-terminal-font-size` sehingga meng-override nilai default mobile.
  - **Solusi**: Mode mobile/tablet kini menggunakan storage key independen `tline-mobile-font-size` yang langsung terinisialisasi ke **9px** secara terpisah dari settingan desktop.

## [1.3.255] - 2026-07-02

### Added / Fixed
- **Left Sidebar Close Button for Mobile & Tablet**: Menambahkan tombol tutup `✕` pada header sidebar kiri ([sidebar-header](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/App.tsx#L757)) yang khusus muncul di mode mobile & tablet, memungkinkan pengguna menutup sidebar berukuran full-screen dengan satu sentuhan.

## [1.3.254] - 2026-07-02

### Changed
- **Default Terminal Font Size for Mobile & Tablet**: Mengubah ukuran default font terminal pada perangkat mobile & tablet (`<= 1024px` atau perangkat layar sentuh) menjadi **9px** (sebelumnya default 12px) untuk memaksimalkan jumlah kolom/baris terminal yang muat di layar.

## [1.3.253] - 2026-07-02

### Changed
- **Full Width Sidebars for Mobile & Tablet**: Memperbarui lebar sidebar kiri ([.sidebar](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/layout.css#L354)) dan sidebar kanan ([.right-sidebar](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/styles/layout.css#L371)) menjadi **100% full width (`100vw`)** saat dibuka pada perangkat mobile maupun tablet (breakpoint `@media (max-width: 1024px)`).

## [1.3.252] - 2026-07-02

### Fixed
- **Mobile Terminal Black Screen Bug**: Memperbaiki masalah terminal yang tidak muncul / layar hitam di tampilan mobile (HP/tablet).
  - **Bypass WebGL Addon on Mobile**: Di perangkat mobile / layar sentuh, WebGL Addon xterm.js dapat mengalami kegagalan konteks render tanpa throw exception yang menyebabkan layer teks hitam/transparan. Di mobile, otomatis menggunakan `CanvasAddon` / DOM renderer yang stabil 100%.
  - **Leaf Pane Active State**: Memastikan prop `active` pada `TerminalInstance` bernilai `true` selama tab terminal aktif, sehingga proses WebSocket `init` dan penyesuaian dimensi (`fit()`) selalu berjalan meskipun dalam mode split pane.
  - **CSS Flex & Height Fix**: Menambahkan `min-height: 0`, `height: 100%`, dan `width: 100%` pada elemen `.terminal-container`, `.terminal-element`, dan `.terminal-element .xterm` agar kalkulasi tinggi layout flexbox tidak bertabrakan pada browser mobile.

### Changed
- **Right Side Tab Actions Layout**: Menyusun 3 ikon aksi utama secara rapi di **sisi kanan** baris tab:
  1. ⚡ **Quick Launch**: Ikon petir yang saat diklik menampilkan menu popover dropdown shortcut dengan penanganan auto click-outside.
  2. 🔲 **Terminal Grid**: Ikon grid untuk membuka tab Terminal Grid baru.
  3. ⌄ **Dropdown Tab Switcher**: Ikon dropdown chevron untuk melihat & berpindah antar tab yang terbuka.

## [1.3.250] - 2026-07-02

### Fixed / Improved
- **Quick Launch & Grid Placement**: Mengembalikan item Quick Launch agar tetap tampil langsung (inline) berupa chip/button di sebelah ikon ⚡ Zap, serta memindahkan Grid button (`<LayoutGrid />`) & Quick Launch secara lengkap ke **sisi kanan** tab bar (kanan sendiri).
  - Quick Launch tidak lagi tersembunyi di dalam dropdown popover, sehingga item-item shortcut favorit tetap dapat diakses secara langsung dengan satu klik.
  - Membuang baris horizontal Quick Launch terpisah di bawah tab bar untuk efisiensi ruang layout.

## [1.3.249] - 2026-07-02

### Fixed
- **Terminal Dispose Error (Real Root Cause)**: Memperbaiki secara tuntas `TypeError: Cannot read properties of undefined (reading '_isDisposed')` pada `AddonManager._wrappedAddonDispose`.
  - **Root cause**: Meskipun addon di-dispose secara manual, xterm's `AddonManager` tetap menyimpan referensi addon di internal `_addons` array. Ketika `term.dispose()` dipanggil, `AddonManager.dispose()` mengiterasi `_addons` dan memanggil `_wrappedAddonDispose()` pada addon yang sudah ter-dispose → crash.
  - **Fix**: Setelah loop pre-dispose addon, clear `(term as any)._addonManager._addons = []` dan `_disposables = []` sehingga `AddonManager.dispose()` menemukan array kosong dan tidak mencoba re-dispose apapun.

## [1.3.248] - 2026-07-02


### Changed
- **Quick Launch UI Refactor**: Quick Launch bar terpisah dihapus dan digantikan dengan icon ⚡ (Zap) yang menjadi dropdown popover di tab bar.
  - Icon ⚡ Quick Launch dan tombol 🔲 Grid dipindahkan ke **sisi kanan** tab bar, sejajar dengan tombol tabs dropdown.
  - Klik icon ⚡ untuk membuka dropdown yang menampilkan daftar shortcuts, serta tombol "Add" untuk menambah shortcut baru.
  - Klik salah satu shortcut langsung menjalankan command dan menutup dropdown.
  - Menghemat ruang vertikal dengan menghilangkan bar tambahan di bawah tab.

## [1.3.247] - 2026-07-02

### Fixed
- **Terminal Addon Dispose Error (Root Cause Fix)**: Memperbaiki secara tuntas `TypeError: Cannot read properties of undefined (reading '_isDisposed')` yang muncul di console saat terminal dihancurkan.
  - Penyebab utama: xterm.js `AddonManager` secara internal mengiterasi semua addon yang ter-register dan memanggil `dispose()` pada setiap addon. Salah satu addon sudah memiliki state internal `undefined` saat iterasi terjadi, menyebabkan crash.
  - Solusi: Menambahkan `addonListRef` untuk melacak **semua** addon yang di-load (`FitAddon`, `Unicode11Addon`, `WebLinksAddon`, `SearchAddon`, `ImageAddon`, `WebglAddon`/`CanvasAddon`). Setiap addon kini di-dispose secara **individual** dengan try-catch sebelum `term.dispose()` dipanggil, sehingga `AddonManager` tidak perlu mengiterasi addon yang sudah di-dispose.
  - Saat WebGL context loss, addon WebGL dihapus dari `addonListRef` setelah di-dispose agar tidak di-dispose dua kali.
  - `CanvasAddon` fallback (baik dari context loss maupun fallback awal) juga ditambahkan ke `addonListRef` agar disposal-nya dikelola dengan benar.

## [1.3.246] - 2026-07-02


### Changed
- **Mobile/Tablet Terminal Split Button UX**: Memindahkan tombol split pane di perangkat mobile/tablet dari posisi kanan bawah ke **kanan atas**, dengan desain yang lebih minimalis.
  - Tombol split tidak lagi selalu terlihat di layar — kini tersembunyi by default dan hanya muncul saat user mengetuk ikon split kecil di pojok kanan atas setiap pane terminal.
  - Menampilkan panel aksi (split horizontal, split vertikal, close pane) hanya saat toggle aktif, lalu menutup otomatis setelah aksi dipilih.
  - Desktop tetap menggunakan perilaku hover-to-reveal yang sama seperti sebelumnya.
  - Refactor `SplitLayoutRenderer.tsx`: logika leaf node dipisah ke komponen `LeafPane` tersendiri agar dapat menggunakan `useState` (React Hooks rule) secara aman.

## [1.3.245] - 2026-07-02

### Fixed
- **WebGL Addon Dispose Crash**: Memperbaiki `TypeError: Cannot read properties of undefined (reading '_isDisposed')` yang terjadi saat terminal dihancurkan atau WebGL context hilang. Bug ini disebabkan oleh version mismatch antara `@xterm/xterm` dan `@xterm/addon-webgl` dimana addon WebGL mencoba mengakses properti internal `_core._store` yang tidak ada di versi xterm yang terinstall.
  - Menambahkan `webglAddonRef` untuk tracking instance WebGL addon dan mencegah double-dispose.
  - Membungkus `webglAddon.dispose()` di `onContextLoss` dengan try-catch agar tidak crash, dengan fallback otomatis ke `CanvasAddon` setelah context loss.
  - Membungkus `term.dispose()` di cleanup useEffect dengan try-catch dan menset semua addon refs ke `null` sebelum disposal untuk mencegah error.
  - GPU stall warning (`GL Driver Message: GPU stall due to ReadPixels`) adalah peringatan performa WebGL normal dan tidak memengaruhi fungsionalitas.

## [1.3.244] - 2026-07-02

### Fixed
- **Loading Bug & Git Leak on Non-Git Workspaces**: Memperbaiki bug loading tanpa akhir pada panel Git Changes dan Snapshots ketika beralih ke/dari workspace tanpa Git, serta membatasi data Git agar tidak bocor di header/footer pada workspace non-Git.
  - **Auto-Switch Workspace Removal**: Menghapus logika auto-switch workspace ke repositori Git lain ketika memilih panel Git Changes/Checkpoints pada workspace non-Git, sehingga workspace aktif tetap terjaga.
  - **Reset Loading States**: Menyetel state `loading` di `CheckpointsPanel.tsx` dan `gitStatusLoading` di `useGitStatus.ts` ke `false` saat early return agar spinner loading tidak berjalan terus-menerus.
  - **Safety Worktree Reset**: Menambahkan safety check di `App.tsx` untuk memastikan `panelWorktreePath` selalu `null` ketika workspace aktif bukan merupakan repositori Git, sehingga menghilangkan badge branch Git di tab bar (header) secara penuh.
  - **Checkpoints Empty State**: Menampilkan tulisan "No workspace selected" secara benar jika tidak ada workspace aktif di panel Snapshots, alih-alih peringatan tidak mendukung Git.

## [1.3.243] - 2026-07-02

### Added
- **Saved Prompt Shortcuts (Quick Launch)**: Menambahkan fitur shortcut prompt perintah tersimpan.
  - Pengguna dapat menyimpan perintah/prompt terminal yang sering digunakan via opsi "Save as Shortcut..." di menu klik-kanan (context menu) tab terminal.
  - Shortcut yang disimpan akan muncul sebagai tombol/pills di area "Quick Launch" bar baru tepat di bawah tab bar utama.
  - Klik pada tombol shortcut akan membuka tab terminal baru dengan CWD dan shell yang sesuai, lalu otomatis menjalankan perintah yang tersimpan setelah delay aman 600ms (auto-execution).
  - Menambahkan tombol "Add Shortcut" di Quick Launch bar untuk membuat shortcut baru secara manual melalui form modal yang terintegrasi (`SavePromptModal`).
  - Shortcut tersimpan dipersistenkan di `localStorage` dan dapat dihapus dengan mengklik tombol `×` pada masing-masing pill shortcut.

## [1.3.242] - 2026-07-02

### Added
- **WebGL GPU-Accelerated Renderer**: Menginstal `@xterm/addon-webgl` dan mengintegrasikannya sebagai render engine utama di `TerminalInstance.tsx`. Jika terjadi context loss pada WebGL (GPU reset/crash), addon otomatis didispose agar xterm.js kembali ke renderer bawaan secara mulus. Jika WebGL tidak didukung oleh browser/lingkungan, sistem secara otomatis melakukan fallback bertahap (progressive fallback) ke Canvas renderer, lalu ke DOM renderer, memastikan performa rendering throughput data yang tinggi dan responsif.
- **Refactoring & Modulerisasi Terminal**: Memisahkan subkomponen pendukung terminal (`TerminalSearchBar`, `SmartPasteConfirm`, `TerminalStatusBar`, dan `TerminalContextMenu`) dari `TerminalInstance.tsx` ke file baru [TerminalSubComponents.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/TerminalSubComponents.tsx) demi menjaga kepatuhan batas panjang file maksimal 1000 baris.

## [1.3.241] - 2026-07-02

### Fixed
- **Terminal Focus & Selection Bug**: Memperbaiki bug di mana menyeleksi teks (text selection) di terminal sering terhapus otomatis ketika mouse dilepas. Hal ini dikarenakan capture-phase event listener click/touchend yang memaksa fokus kembali ke textarea terminal. Kini, programmatic focus dinonaktifkan ketika target klik berada di dalam `.xterm` atau ketika terminal memiliki seleksi aktif, memulihkan perilaku klik dan seleksi teks bawaan terminal yang sebenarnya.

## [1.3.240] - 2026-07-02

### Fixed
- **Infinite Reload Loop on Non-Git Workspaces**: Memperbaiki bug "flash flash" (flickering/reloading tak terbatas) di panel Explorer dan Git Changes pada workspace tanpa Git. Masalah ini disebabkan oleh hook `useGitStatus.ts` yang selalu mengembalikan referensi array baru `[]` (karena `setChangedFiles([])` dipanggil setiap kali status git di-fetch untuk workspace non-git), yang memicu trigger update `fsChangeTrigger` di `App.tsx`, yang kemudian memicu re-render dan me-load ulang file explorer secara terus-menerus. Diperbaiki dengan mengembalikan referensi `prev` yang sama jika array sudah kosong.

## [1.3.239] - 2026-07-02

### Fixed
- **Workspace Non-Git Error & Loading Bug**: Memperbaiki bug di mana Explorer, Changes, dan Snapshot/Checkpoints mengalami crash atau error ketika menggunakan workspace yang tidak memiliki repositori Git.
  - **Checkpoints/Snapshots**: Menambahkan proteksi pada `CheckpointsPanel.tsx` agar tidak melakukan fetch data checkpoints jika workspace bukan Git, sehingga langsung menampilkan peringatan "Checkpoints are only supported in Git workspaces." secara bersih tanpa error 500.
  - **Git Changes**: Memperbarui tampilan kosong (empty state) di tab Git Changes untuk menampilkan pesan "Git changes are only supported in Git workspaces." jika workspace yang aktif bukan Git.
  - **App.tsx Active Panel Switcher**: Menambahkan sinkronisasi workspace otomatis ketika berpindah ke panel checkpoints; jika workspace aktif bukan Git, otomatis berpindah ke workspace Git pertama yang tersedia.
  - **Backend gitRoutes Middleware**: Menambahkan middleware `gitWorkspaceMiddleware` pada route endpoints di `backend/src/gitRoutes.ts` yang berawalan `/workspaces/:id` untuk memvalidasi dan menolak request dengan status 400 Bad Request jika workspace target bukan repositori Git.

## [1.3.238] - 2026-07-02

### Fixed
- **Dropdown Select Terminals Tertimpa Terminal Grid Card**: Meningkatkan z-index pada `.grid-tab-header` dan memberikan `position: relative` agar dropdown konfigurasi terminal grid tampil di atas komponen-komponen terminal card (seperti status bar dan search bar) tanpa terpotong atau tertimpa.

## [1.3.237] - 2026-07-02

### Added
- **Mobile Tab Bar di Header**: Pada layar mobile/tablet (≤768px), tab-tab terminal kini tampil langsung di header (top-bar) sebagai strip horizontal yang dapat discroll. Mengklik tab langsung berpindah ke terminal tersebut. Setiap tab menampilkan ikon tipe (terminal, file, diff, grid), nama tab, dan tombol tutup (×). Tombol `+` di ujung kanan strip memungkinkan membuka terminal baru langsung dari header.

## [1.3.236] - 2026-07-02

### Fixed
- **Terminal Tidak Berfungsi di Workspace Non-Git**: Workspace yang bukan repository Git (folder biasa tanpa `.git`) kini dapat membuka terminal dengan benar. Root cause: `handleWorkspaceClick` selalu men-set `panelWorktreePath` ke `ws.path`, padahal untuk workspace non-git tidak ada worktrees — sehingga `filteredTabs` memfilter semua tab keluar karena worktree target tidak ditemukan.
- **Sync Worktree Path Salah untuk Non-Git**: `useEffect` sinkronisasi panel di `App.tsx` juga di-fix: workspace non-git kini selalu menggunakan `panelWorktreePath = null`, sedangkan git workspace menggunakan path `mainWt` yang akurat (bukan `ws.path` yang sebelumnya bisa berbeda dari path worktree utama).

## [1.3.235] - 2026-07-02

### Fixed
- **Open Terminal dari Home Tidak Berfungsi**: Terminal yang dibuka dari tombol "Open Terminal" di halaman welcome/home (saat belum ada tab terbuka) kini langsung muncul. Sebelumnya tab baru difilter keluar oleh `filteredTabs` karena `panelWorkspace` belum diset saat render pertama.
- **Open Terminal dari Context Menu Workspace (Titik Tiga) Tidak Berfungsi**: Tombol "Open Terminal" di dropdown titik tiga workspace kini memanggil `setPanelWorkspace` terlebih dahulu sebelum membuka terminal, sehingga tab baru langsung terlihat di tab bar workspace yang benar.
- **EmptyDashboard**: Tombol "Open Terminal" kini otomatis menggunakan workspace pertama (`workspaces[0]`) jika belum ada workspace yang dipilih, sehingga terminal selalu dapat dibuka walaupun user belum mengklik workspace manapun.

## [1.3.234] - 2026-07-02

### Fixed
- **Terminal Font Scaling on Mobile/Tablet**: Removed the hardcoded 8px terminal font size lock on mobile/tablet screens. Font size changes now correctly respect the user's settings.
- **Terminal Font Options Fit Refresh**: Added a forced xterm layout recalculation (`fit()`) after changing the font size, font family, or font weight options to ensure immediate visual alignment.

## [1.3.233] - 2026-07-02

### Added
- **Reorderable Tabs**: Drag-and-drop support to swap tab positions directly in the main Chrome-like tabs container.
- **Context Menu Tab Actions**: Left and right tab moving options in the Tab Context Menu ("Move Tab Left" / "Move Tab Right").
- **Dropdown List Reordering**: Reorder action buttons (ArrowUp / ArrowDown) on hover in the open tabs dropdown menu to move tabs up/down.

## [1.3.232] - 2026-07-02

### Fixed
- **Empty Workspaces Message Positioning**: Conditionally rendered `WorkspaceList` to prevent the empty list wrapper from occupying layout height and pushing the "No workspaces registered." text to the bottom center of the sidebar panel. The message now displays at the top center.

## [1.3.231] - 2026-07-02

### Changed
- **RAM and CPU Optimizations**: 
  - Exposed Node.js Garbage Collection (`--expose-gc`) in both Electron main process and Backend fork configurations.
  - Registered window state observers (`minimize`, `hide`) to manually invoke garbage collection and release memory back to the OS immediately after user minimizes or hides the app window.
  - Implemented a 60-second periodic garbage collection schedule in the backend service.
  - Extended backend process lookup cache lifetime from 2 seconds to 5 seconds to reduce expensive process listing command (wmic / ps) CPU overhead.
  - Reduced terminal process title update interval from 1s to 3s, and terminal process tree polling interval from 2.5s to 5s.

## [1.3.230] - 2026-07-02

### Changed
- **Electron Performance Optimizations**: 
  - Prevented window visual flickering by hiding the window creation initially (`show: false`) and showing it only after the `ready-to-show` event fires.
  - Enabled Electron's `backgroundThrottling: true` to throttle CPU and timers when the window is hidden or minimized.
  - Throttled background status/session polling from every 5 seconds to every 15 seconds when the main window is hidden or minimized, reducing local HTTP overhead and CPU consumption.

## [1.3.229] - 2026-07-02

### Fixed
- **Workspace Disappearance on Password Change**: Fixed a bug where changing the master password deleted all workspaces from the configuration. The application now properly merges and preserves existing configuration options (like the `workspaces` array) when updating the master password.

## [1.3.228] - 2026-07-02

### Fixed
- **Terminal Grid Default Empty Selection on Load**: Normalized the restored tabs layout from `localStorage` to ensure grid tabs initialize `gridTerminalIds` to an empty array (`[]`) instead of resolving to all active terminal IDs by default, preventing unexpected auto-population of terminal grid cards on application startup.

## [1.3.227] - 2026-07-02

### Fixed
- **Electron Build Missing Updater**: Added `updater.js` to the electron-builder `files` whitelist in `desktop/package.json` to prevent JavaScript load errors (`Cannot find module './updater'`) in packaged builds.

## [1.3.226] - 2026-07-02

### Fixed
- **Toast Theme Color Integration**: Synchronized toast notification icon and text colors with the active workspace theme accent color by using CSS variables and dynamic `color-mix` functions.

## [1.3.225] - 2026-07-02

### Changed
- **Toast Notifications Customization**: Limited the active toast count to a maximum of 2 to avoid cluttering the screen. Moved the toast notification container to the bottom-right corner of the application.
- **Session Re-attached Toast ID Display**: Appended the terminal session ID to the "Session Re-attached" toast notification message.

## [1.3.224] - 2026-07-02

### Added
- **Workspace Panel Scrolling & Search Toggle**: Restructured the workspace list container layout in the sidebar using flexbox, confining scrolling to the list items while keeping the heading fixed at the top. Added a search button next to the plus icon to toggle search input visibility (hidden by default) with auto-focus and clear actions.

## [1.3.223] - 2026-07-02

### Fixed
- **Terminal Tab Auto-Focus**: Fixed a race condition on mount and tab switching where newly opened or switched terminal tabs would not focus the text entry cursor. Introduced a reactive `isInitialized` state that triggers focus once xterm.js has finished setting up the terminal DOM and textarea elements.

## [1.3.222] - 2026-07-02

### Fixed
- **Dropdown Background Transparency**: Set the layout selector popover background to use `var(--bg-main)` and strengthened the drop shadow, ensuring it is 100% solid and opaque so terminal content underneath does not overlap or show through the dropdown menu options.

## [1.3.221] - 2026-07-02

### Added
- **Terminal Termination Confirmation Modal**: Implemented a custom overlay modal dialog with backdrop-blur, confirming when a user clicks the "Trash" (terminate) button on a grid card. This warns the user that closing the terminal will kill its background process and all running scripts inside it.

## [1.3.220] - 2026-07-02

### Added
- **Persisted Card Resizing**: Added global sliders (Card Width and Card Height) inside the select popover to dynamically resize all terminal grid cards.
- **Tab Layout Size Persistence**: Persisted custom card width and height values inside the `gridCardWidth` and `gridCardHeight` properties of the grid tab's state, preserving layouts across sessions in `localStorage`.

## [1.3.219] - 2026-07-02

### Added
- **Manual Grid Addition**: Reverted auto-population so that new Terminal Grid tabs start completely empty by default, allowing users to select and build their grid manually.
- **Close & Terminate Terminal Action**: Added a close/terminate button (Trash icon) in the card headers of the grid view to completely terminate the PTY session and remove it from the workspace, in addition to the "Hide from grid" option.

## [1.3.218] - 2026-07-02

### Added
- **Tab Auto-Population**: Pre-populates new Terminal Grid Monitor tabs with all currently open terminal sessions upon creation, eliminating the need to manually configure them one by one.
- **Tab Label & Header Resolution**: Resolved terminal items to their parent Tab names (e.g. `Shell (t-line)`) in the dropdown selector, suggestions list, and grid card headers, making it easy to identify and display existing tabs.
- **Unfocused Grid Session Connection**: Implemented a `disableAutoFocus` prop on `TerminalInstance` to connect and initialize all unfocused grid cards in the background without stealing active browser keyboard focus.

## [1.3.217] - 2026-07-02

### Added
- **Terminal Grid Monitor**: Implemented a cross-workspace Terminal Grid Monitor tab that allows users to select, layout, and monitor active terminal instances across all workspaces in a single unified grid view.
- **Interactive Grid Cards**: Each card in the grid view renders a live interactive terminal pane, shows running processes dynamically, displays a workspace mapping badge, and supports one-click focusing (switching the main window view directly to the terminal's parent tab).

## [1.3.216] - 2026-07-02

### Added
- **Typing Latency Optimization**: Bypassed batching/debouncing queues for small data chunks (<= 5 bytes, such as manual keystrokes and their echoing) in both backend PTY sending and frontend xterm writing. Keystrokes are now sent and rendered in real-time, eliminating the typing lag while retaining the performance advantages of batching for high-throughput commands.

## [1.3.215] - 2026-07-02

### Added
- **Process List Caching**: Implemented a global cached process tree fetcher in `backend/src/terminalManager.ts` with a 2-second TTL. This aggregates concurrent PTY status polling requests across multiple terminals (e.g., in split panes) into a single system command invocation, greatly reducing background CPU load and UI stutters.

### Changed
- **Terminal Resize Fitting Throttling**: Optimized the `debouncedFit` handler in `frontend/src/components/TerminalInstance.tsx` by using `requestAnimationFrame` with a 50ms throttle during active drag-resizing, and debouncing layout updates to avoid layout thrashing and redundant timers.

## [1.3.214] - 2026-07-02

### Added
- **Backend Persistent Log File**: Added global overrides for `console.log`, `console.error`, and `console.warn` inside the backend workspace to automatically save all logs, warnings, errors, and stack traces to `~/.tline-backend.log` with a 5MB auto-rotation limit. This ensures logs are preserved even during local development restarts and terminal window closures.

## [1.3.213] - 2026-07-02

### Added
- **Backend Auto-Restart**: Implemented automatic restart logic in the Electron desktop main process to transparently relaunch the backend on crashes.
- **Terminal Keep-Alive Timeout**: Increased the PTY session detach timeout from 30 seconds to 10 minutes, allowing terminal states and running processes to persist through network reconnections, application reloads, or temporary backend restarts.

### Changed
- **Backend Memory Limits**: Raised the backend V8 old space size limit from 192MB to 512MB to avoid OOM crashes on large repos.
- **Refactoring**: Extracted auto-updater functions into a separate `updater.js` helper file to keep `desktop/main.js` below the 1000-line limit.

## [1.3.212] - 2026-07-01

### Fixed
- **Git status path parsing**: Added unescape and unquote support for paths containing spaces, double quotes, and multi-byte UTF-8 octal escape sequences in `backend/src/gitManager.ts` and `backend/src/checkpointManager.ts` to ensure files are correctly tracked, staged, and unstaged in the File Explorer and Changes tab.

## [1.3.211] - 2026-07-01

### Fixed
- **CSP / Fonts**: Allowed `data:` URIs in `font-src` directive in `frontend/index.html` to resolve issues loading base64-embedded fonts (e.g. from Monaco Editor).

## [1.3.210] - 2026-07-01

### Added
- **Testing**: Configured Vitest, React Testing Library, and jsdom environment in the frontend workspace.
- **Git Tests**: Implemented comprehensive unit/integration test suite for Git-related features:
  - Verified git status decorators and directory changes count badges in `FileExplorer`.
  - Tested stage, unstage, discard, and commit user interactions and API calls in `GitChanges`.

## [1.3.209] - 2026-07-01

### Fixed
- **Git & Explorer**: Fixed a bug where git changes in the sidebar and file explorer's modified (M) and untracked (U) badges were not updated in real-time. This was resolved by:
  - Making path relative calculation case-insensitive to correctly match paths on Windows regardless of casing or drive letters.
  - Updating the file system watcher in the backend to monitor key Git control files (`.git/index`, `.git/HEAD`, `.git/refs`) so that Git operations run in the terminal immediately trigger Git status updates.

## [1.3.208] - 2026-07-01

### Changed
- **Documentation**: Updated README.md preview image (`preview.png`) to showcase the latest workspace manager interface.

## [1.3.207] - 2026-07-01

### Fixed
- **Terminal**: Fixed Ctrl+V / paste event double paste bug by registering the custom paste handler in the capturing phase (`useCapture = true`) and invoking `e.stopImmediatePropagation()`. This intercepts paste events before xterm's native handler can execute and prevents duplicate values.

## [1.3.206] - 2026-07-01

### Fixed
- **Version Reporting**: Bumped package.json versions across all workspaces (root, backend, frontend, desktop) and updated server.ts fallback to correctly report the application version in the UI.

## [1.3.205] - 2026-07-01

### Fixed
- **Terminal**: Resolved Ctrl+V double paste bug — now always blocks xterm and browser native paste handlers, then reads clipboard manually via `navigator.clipboard.readText()` once. Increased debounce threshold from 100ms to 300ms as additional safety net.

## [1.3.204] - 2026-07-01

### Fixed
- **CI/CD**: Fixed electron-builder publish argument passing in GitHub Actions — use `working-directory` and direct `npx electron-builder --publish always` instead of npm workspace proxy.

## [1.3.203] - 2026-07-01

### Fixed
- **CI/CD**: Fixed GitHub Actions release workflow to properly upload binaries to GitHub Releases by adding `--publish always` flag to `electron-builder`.

## [1.3.202] - 2026-07-01

### Changed
- **Application Port Configuration**:
  - Changed the default backend server port from `3999` to `5779` (`backend/src/server.ts`, `desktop/main.js`).
  - Changed the frontend Vite development server port from `5173` to `5773` (`frontend/vite.config.ts`).
  - Updated the Vite proxy target for `/api` to point to the new backend port `5779`.
  - Updated the WebSocket client dev-mode port detection in `frontend/src/services/websocket.ts` to check for port `5773` and fallback to `5779`.

---

## [1.3.201] - 2026-07-01

### Fixed
- **System Update Checker**:
  - Fixed a critical bug in `checkUpdates` where the `updateAvailable` state was never reset to `false` when the latest release on GitHub was older than or equal to the current version.
  - Dynamically imported the application version from the frontend's own `package.json` to act as the default fallback version (instead of the outdated hardcoded `'1.3.73'`), avoiding false update triggers.
  - Updated the backend version endpoint `/api/system/version` fallback version to `1.3.201`.
  - Triggered the update checker's `fetchLocalVersion` whenever `isAuthenticated` transitions to `true` (indicating successful authentication and a responsive backend), resolving race conditions where the checker ran before the backend server finished starting up.

---

## [1.3.200] - 2026-07-01

### Fixed
- **Terminal Double Paste on Ctrl+V**:
  - Registered a native `paste` event listener directly on xterm.js's helper `textarea` to intercept all paste events (Ctrl+V, Cmd+V, Shift+Insert, and Edit -> Paste native menu triggers).
  - Implemented event prevention (`e.preventDefault()`, `e.stopPropagation()`) in the paste listener to completely bypass xterm's native paste handler, avoiding duplicate paste triggers.
  - Intercepted Ctrl+V (and Cmd+V on macOS) in the custom key event handler to return `false` in Electron (avoiding PTY character emission) while allowing standard propagation in browsers.
  - Added a ref-based `performPaste` utility with 100ms/identical-content paste deduplication as a safety layer.

---

## [1.3.199] - 2026-07-01

### Changed
- **Logo & Icon Color Theme Redesign**: Updated the brand logo (`TPlusLogo`), desktop icon (`icon.svg`, `icon.png`), and web favicon from the feminine violet/purple scheme to a professional Indigo & Cyan palette.
- **Default Application Theme Accent**: Changed the default theme's primary accent color from Violet (`#a855f7`) to Indigo (`#6366f1`) and updated all fallbacks and related styles to provide a clean, tech-focused, and gender-neutral user interface.

---

## [1.3.198] - 2026-07-01

### Changed
- **Checkpoint/Snapshot UI Enhancement**: Styled "Autosave" snapshot cards with a distinct amber theme and added an auto-generated "autosave" badge to distinguish them from standard checkpoints, making it easier for users to identify automatic revert points.

---

## [1.3.197] - 2026-07-01

### Added
- **Auto-Snapshot before Restore (Autosave)**: If the working directory has unsaved (dirty) changes when restoring a snapshot, the system will automatically create a temporary "Autosave" snapshot of those changes before resetting and performing the checkout/restore. This prevents any loss of work and allows reverting/recovering back to the dirty state.

---

## [1.3.196] - 2026-07-01

### Changed
- **Checkpoint/Snapshot UI**: Replaced native browser `window.confirm` and `alert` prompts with custom modal-based dialogs (`ConfirmModal` / `useConfirmDialog`) for checkpoint restore, delete, and create operations, resulting in a cleaner and more integrated user interface.

---

## [1.3.195] - 2026-07-01

### Fixed
- **Git Changes Untracked Files/Folders Detection**:
  - Appended the `-u` (show untracked files) flag to the `git status --porcelain` command in `gitManager.ts`. This ensures Git reports individual files inside newly created/untracked folders, allowing them to bypass the directory-excluding filter and display correctly in the Git Changes side panel.

### Refactored
- **Strict File Length Limit Compliance**:
  - Extracted all checkpoint/snapshot functions and types (such as `Checkpoint` interface, `getMetaPath`, `getCheckpoints`, `createCheckpoint`, `restoreCheckpoint`, and `deleteCheckpoint`) from the monolithic `gitManager.ts` file into a new dedicated module, `checkpointManager.ts` (approx. 250 lines).
  - Updated `gitRoutes.ts` imports to consume the migrated functions, ensuring the codebase complies with the strict 1000-line limit per file.

---

## [1.3.194] - 2026-07-01

### Changed
- **Documentation**: Updated `README.md` to detail key new features including SSH/SFTP Remote Workspace support, Workspace Checkpoints (Snapshots), interactive file explorer operations, theme-aware SVGs, and binary file warnings.

---

## [1.3.193] - 2026-07-01

### Added
- **SSH/SFTP Remote Workspace Support**:
  - **Backend Helpers**: Created [sshHelpers.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/sshHelpers.ts) to manage remote SSH filesystem operations, directory listing (`ls -F -A`), file read/write (`cat`/`head` / stdin streaming), and file check operations using native OpenSSH CLI tools.
  - **SSH Workspace Interception**: Adapted [fsRoutes.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/fsRoutes.ts) and [gitManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/gitManager.ts) to inspect path prefixes and automatically delegate operations to remote servers when target directories start with `ssh://`.
  - **Checkpoints over SSH**: Programmed remote checkpoints configuration metadata support, saving snapshots (`tline-checkpoints.json`) in the remote `.git` common directory.
  - **Interactive Remote Terminals**: Integrated remote terminal session support in [terminalManager.ts](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/backend/src/terminalManager.ts), launching an interactive `ssh -t` terminal when creating shell instances for SSH-prefixed directories.
  - **UI Add Workspace Hints**: Updated [Modals.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/Modals.tsx) workspace add input to display hints on remote SSH paths (`ssh://user@host:port/path`) and disable the local directory explorer button for remote inputs.

---

## [1.3.192] - 2026-07-01

### Added
- **File Explorer Operations (Rename, New File, New Folder)**:
  - **Backend Endpoints**: Added `/api/fs/create` to create empty files and folders, and `/api/fs/rename` to rename/move files and folders.
  - **Reusable Modal**: Added `InputModal` in `Modals.tsx` to handle user input prompts with clean Glassmorphism styling and focus handling.
  - **Explorer Header Actions**: Integrated new file and folder buttons next to the Refresh button in the explorer panel header.
  - **Explorer Context Menu**: Extended context menu items for workspace items to support creating new files/folders relative to the selected item and renaming files/folders.

---

## [1.3.191] - 2026-07-01

### Fixed
- **Terminal Pane Split Buttons in Light Mode**:
  - Dynamically styled the terminal floating action bar (containing horizontal split, vertical split, and close pane buttons) to use custom translucent light styling in light mode. This replaces the hardcoded dark background and border styling with a clean light layout that integrates perfectly with the light theme.
  - Adapted the pane resize handles to use a softer purple translucency in light mode to improve contrast and feel premium.

---

## [1.3.190] - 2026-07-01

### Fixed
- **Terminal Padding Clipping of Bottom Rows**:
  - Isolated the xterm `.terminal-element` container inside a wrapper class `.terminal-element-wrapper`. Shuffled the padding styling over to this wrapper and kept `.terminal-element` at `width: 100%; height: 100%`. This enables xterm's FitAddon to calculate row sizes based on the true content container height, preventing the bottom shell lines from being clipped or covered by the terminal status bar.

---

## [1.3.189] - 2026-07-01

### Fixed
- **Terminal Status Bar Hidden Overflow**:
  - Replaced `.terminal-element` hardcoded `height: 100%` with `flex: 1` and `min-height: 0` to align with the parent flexbox layout. This prevents the terminal container from pushing the `TerminalStatusBar` (at the bottom of the pane) off-screen and being clipped.

---

## [1.3.188] - 2026-07-01

### Changed
- **Branch Management Modal â€” Redesign & Feature Upgrade**:
  - **Redesigned UI**: Replaced the plain browser `<select>` dropdown with a custom scrollable branch list panel. Active branch is highlighted with a purple left-border indicator and check icon.
  - **Branch Search**: Added a live search/filter input at the top of the branch list, letting users instantly filter by name across many branches.
  - **Branch Deletion**: Each non-active branch now shows a trash icon on hover. Clicking it reveals an inline confirmation row. If Git reports unmerged changes, the modal escalates to a force-delete prompt before proceeding.
  - **Fetch Repository**: Added a "Fetch" action button alongside Pull and Push, wired to a new `POST /api/workspaces/:id/git/fetch` endpoint that runs `git fetch --all --prune`.
  - **3-Column Sync Grid**: Fetch / Pull / Push are rendered side-by-side in a uniform grid with consistent sizing and hover effects. Push uses a primary purple accent; Fetch and Pull use a neutral ghost style.
  - **Premium Animations**: Overlay fades in and the modal card scales up with a spring bounce animation on open.
  - **Self-Contained Styles**: All modal styles are scoped via a `<style>` block inside the component to avoid polluting global CSS.

### Added (Backend)
- `deleteBranch(repoPath, branchName, force)` in `gitManager.ts` â€” runs `git branch -d` / `git branch -D`.
- `fetchRemote(repoPath)` in `gitManager.ts` â€” runs `git fetch --all --prune`.
- `POST /api/workspaces/:id/git/branch/delete` route in `gitRoutes.ts`.
- `POST /api/workspaces/:id/git/fetch` route in `gitRoutes.ts`.

---

## [1.3.186] - 2026-07-01

### Changed
- **Redesigned Git Branch Group Badge**:
  - Polished the Git branch badge in the `.content-tabs-bar` to float cleanly off the bottom border using `margin-bottom: 5px`.
  - Upgraded the badge style to a premium pill shape (`border-radius: 10px`) with refined vertical height, padding, and subtle translucent colors (`color-mix` values) for optimal visual alignment with tab controls.

---

## [1.3.185] - 2026-07-01

### Fixed
- **Clipping of Active Tab Bottom Border Overlap**:
  - Adjusted the height of `.chrome-tabs-container` to `calc(100% + 1px)` and positioned it with `bottom: -1px; overflow: hidden`.
  - This allows the active tab and its outward curves to sit on top of the `.content-tabs-bar` container's bottom border without being clipped by `overflow: hidden`, successfully masking the border under the active tab.

---

## [1.3.184] - 2026-07-01

### Changed
- **Chrome-like Seamless Active Tab Curves**:
  - Implemented smooth, outward bottom-corner curves for active tabs (`.tab-active::before` and `.tab-active::after`) using radial-gradient overlays to blend the active tab seamlessly into the workspace panel.
  - Removed side borders of active tabs and replaced them with top-only accent colors to mimic the modern Google Chrome tab design.

---

## [1.3.183] - 2026-07-01

### Changed
- **Active Tab Seamless Merging**:
  - Aligned all tabs to the bottom of the `.content-tabs-bar` container using `align-items: flex-end`.
  - Configured the active tab (`.tab-active`) to use the exact background color of the workspace panel (`var(--bg-main)`).
  - Overlapped the parent container's bottom border under the active tab using `margin-bottom: -1px` and `z-index: 2` to remove the separation line and seamlessly join the active tab with the terminal/content below it.
  - Aligned the New Terminal (+) and switcher dropdown buttons to stay vertically centered relative to tab height.

---

## [1.3.182] - 2026-07-01

### Changed
- **Content Integrated Tab Bar**:
  - Relocated the chrome-like tab bar (`chrome-tabs-container` and dropdown switcher) from the global window `top-bar` down into the `.content-area`.
  - Positioned the tab bar directly on top of the active workspace panel (e.g. above terminal panes, Monaco file viewers, and diff view tabs), matching modern editor styles (such as VS Code editor tab headers).
  - Added CSS layout rules for `.content-tabs-bar` with consistent background (`var(--bg-sidebar)`) and borders.

---

## [1.3.181] - 2026-07-01

### Fixed
- **Terminal Text Selection & ANSI Colors in Light Mode**:
  - Dynamically cleared `selectionForeground` (setting it to `undefined`) in light mode so that selected terminal text preserves its original high-contrast foreground color, instead of forcing white text on a light background.
  - Adjusted the 16 ANSI colors (black, green, yellow, blue, magenta, cyan, and white) to use higher-contrast/inverted variants specifically when in light mode, ensuring full readability of build scripts and CLI output.

---

## [1.3.180] - 2026-07-01

### Added
- **Workspace & Worktree Checkpoints (Snapshots)**:
  - Added a brand new **Snapshots** panel in the sidebar to capture the exact working state of any Git workspace or worktree.
  - Snapshot creation preserves all staged/unstaged changes and untracked files by creating a custom Git reference (`refs/tline/checkpoints/*`) to shield it from Git garbage collection without cluttering the user's regular stashes.
  - Supported viewing and expanding snapshots to list modified files and open side-by-side diff comparisons directly in Monaco editor tabs.
  - Enabled one-click restoring of snapshots (switching to the snapshot's branch/commit and applying changes) and deletion.

---

## [1.3.179] - 2026-07-01


### Fixed
- **Light Theme Tab Switcher Dropdown** (`App`, `TabsDropdown`):
  - Fixed color contrast issues in light theme mode (where inactive tabs had extremely low contrast, light gray text on a white background).
  - Used semantic CSS variables (`--ws-dropdown-bg`, `--ws-dropdown-border`, `--text-main`, `--text-muted`, and `--ws-dropdown-shadow`) so the dropdown switcher automatically adapts between dark and light themes with premium aesthetics.

### Added
- **Search & Filter in Tab Switcher Dropdown** (`TabsDropdown`):
  - Added an auto-focused search bar inside the dropdown menu to filter open tabs dynamically by name, path, cwd, or shell type.
- **Keyboard Navigation** (`TabsDropdown`):
  - Supported navigating filtered items using `ArrowUp`/`ArrowDown`, selecting using `Enter`, closing the dropdown with `Escape`, and closing the highlighted tab using `Delete`/`Backspace` when the search query is empty.
  - Implemented automatic smooth scrolling to keep the highlighted item in view during keyboard navigation.
- **Enhanced Tab Switcher Metadata** (`TabsDropdown`):
  - Grouped and counted tabs by category (Files, Terminals, Diffs) inside the header.
  - Displayed relative path/cwd information and Git branch badges for each tab item.
- **Footer Quick Actions** (`TabsDropdown`):
  - Added "Close Others" and "Close All" quick action buttons at the bottom of the dropdown.

---

## [1.3.176] - 2026-07-01

### Fixed
- **Light Mode Colors** (`FileViewerTab`):
  - Replaced all hardcoded dark Tailwind color classes (`bg-slate-900`, `border-slate-800`, `text-slate-300`, `text-slate-400`, `hover:text-white`, `hover:bg-white/5`) with adaptive CSS variable equivalents (`var(--bg-card)`, `var(--border-color)`, `var(--text-muted)`, `var(--text-main)`, `var(--surface-overlay-hover)`).
  - **Preview/Code toggle** container and inactive button text now adapts correctly in light mode.
  - **Zoom controls** (Zoom In, Zoom Out, Reset) in image/SVG viewer now use theme-aware colors on hover.
  - **Skeleton loading** bars now visible in light mode (using `--surface-overlay` instead of opaque dark slate).
  - **Binary file warning** panel no longer hardcodes a dark background (`#0a0a0c`) â€” now uses `var(--bg-main)`.
  - **PDF viewer** container background now adapts to theme.
  - All **file path** spans across image, PDF, binary, and code editor viewers use `var(--text-muted)` for consistent adaptive contrast.
  - **Revert button** in code editor header uses adaptive hover background.

## [1.3.178] - 2026-07-01

### Added
- **Commit Diff in Dedicated Tab** (`GitHistory`):
  - Clicking a file in the **Changed Files** section of Commit Details now opens the file's diff in a **new dedicated tab** (type `diff`) rather than an inline panel within the sidebar.
  - Diff tabs use a `Î” filename (shortHash)` naming convention and a green `GitCompare` icon in the tab bar to distinguish them from regular file tabs.
  - The `DiffViewerTab` component features: dual gutter line numbers (old/new), collapsible hunks, per-line add/delete/context coloring, and addition/deletion stats in the header.
  - Files with `deleted` status are grayed out and non-clickable (no diff can be shown for deleted files).
  - Opening the same commit+file diff a second time reuses the existing tab instead of creating a duplicate.

### Added
- **Resizable History / Commit Details panels** (`GitHistory`):
  - A **drag handle** (`row-resize` cursor) is now rendered between the **Git Commit History** list and the **Commit Details** panel.
  - Dragging the handle resizes the two panels vertically between 20% and 80% of the available height.
  - The resize handle highlights with a purple accent on hover for clear discoverability.

---

## [1.3.177] - 2026-06-30

### Changed
- **Image & SVG Preview Background**:
  - Preview area background now uses `var(--bg-main)` to match the active theme instead of a hardcoded dark color.
  - Replaced radial dot pattern with a clean **square grid** (`24Ã—24px`) using `linear-gradient` CSS backgrounds. Grid line color is controlled by the new `--preview-grid-line` CSS variable: subtle white (`rgba(255,255,255,0.05)`) on dark themes, subtle black (`rgba(0,0,0,0.07)`) on Light Mode â€” automatically adapts with no JavaScript.
  - Grid container background uses `var(--bg-sidebar)` and border uses `var(--border-color)`, both theme-aware.
  - Zoom controls overlay now uses `var(--bg-card)` and `var(--border-color)` instead of hardcoded dark colors.

---

## [1.3.176] - 2026-06-30

### Fixed
- **SVG Preview & Code Edit in Tab**:
  - SVG files now always load their XML content as text on open, eliminating the need for a re-fetch when switching between Preview and Code modes. Mode switching is now instant with no loading skeleton flash.
  - SVG preview is now rendered via a dynamically generated **blob URL** created from the in-memory content (`editedContent`), instead of the `/api/fs/raw` HTTP endpoint. This resolves rendering failures caused by auth token propagation on `<img>` tags, Electron CSP restrictions, and browser caching that would prevent the preview from reflecting post-save edits.
  - The blob URL is automatically revoked and regenerated whenever the SVG content changes (including after every auto-save), ensuring the Preview tab always reflects the latest editor state in real-time.

---

## [1.3.175] - 2026-06-30

### Fixed
- **Image Preview Container Layout**:
  - Re-implemented the checkerboard wrapper container style using absolute positioning inside the relative parent. This guarantees the container correctly inherits parent boundary dimensions and prevents layout collapsing/blank screens in flex parent environments.

---

## [1.3.174] - 2026-06-30

### Fixed
- **SVG Preview Rendering**:
  - Added explicit container width/height styling for SVG image views. This prevents the SVG from collapsing to 0x0 size in CSS due to circular dependencies between relative image sizes and parent flex containers.

---

## [1.3.173] - 2026-06-30

### Added
- **Binary File Handling in Editor Tabs**:
  - Implemented binary file detection (`.exe`, `.zip`, `.dll`, `.mp3`, `.mp4`, etc.) in `FileViewerTab`.
  - Added a binary warning UI with a "Reveal in Explorer" button to prevent reading binary files as text, avoiding browser freezes/crashes and auto-save corruption.
- **SVG Preview & Code Toggle**:
  - Added a preview/code toggle in `FileViewerTab` header for `.svg` files. Users can now switch between visual vector graphics preview and direct XML code editing.

---

## [1.3.172] - 2026-06-30

### Added
- **Visual Distinctions for Hidden/Dot Files**:
  - Implemented the `.explorer-item-muted` CSS style class in `components.css` to render files/directories starting with `.` (e.g. `.gitignore`, `.env`, `.github`, `.agents`) slightly faded/translucent (opacity: 0.55). This matches premium IDE aesthetics and helps distinguish hidden configurations from primary source files.

---

## [1.3.171] - 2026-06-30

### Fixed
- **Show node_modules and Build Folders**:
  - Restored visibility of `node_modules`, `dist`, and `dist-exe` directories in the file explorer. Only `.git` folder remains hidden.

---

## [1.3.170] - 2026-06-30

### Fixed
- **Filter Out .git Folder**:
  - Restored the `.git` metadata folder exclusion while keeping all other hidden dotfiles and dot-directories visible in the file explorer.

---

## [1.3.169] - 2026-06-30

### Added
- **Show Hidden Files in File Explorer**:
  - Removed filters that exclude hidden files and directories starting with `.`, exposing `.gitignore`, `.env`, `.github`, `.git`, `.agents`, etc. to the file explorer. Dependency and build directories (`node_modules`, `dist`, `dist-exe`) remain excluded.
- **Refactoring Server File Length**:
  - Extracted all Express filesystem routes (`/list`, `/explore`, `/read`, `/raw`, `/write`, `/delete`, `/open-explorer`) from `backend/src/server.ts` into a new router file `backend/src/fsRoutes.ts`. This reduces the file length of `server.ts` to ~740 lines, keeping it well within the strict 1000-line limit.

---

## [1.3.168] - 2026-06-30

### Fixed
- **Git Changes: Missing First Character in Filename**:
  - Replaced `stdout.trim()` with `stdout.trimEnd()` in the `runGit` process execution utility. Using `trim()` stripped leading whitespace on the first line of the output (which is used by `git status --porcelain` to indicate unstaged status codes, e.g. ` M package-lock.json`), causing columns to shift left and parsing functions to slice off the first character of filenames.

---

## [1.3.167] - 2026-06-30

### Fixed
- **Git Commit History: Slashes & Backslashes Column Alignment**:
  - Corrected the coordinate logic for diagonal curves (`/` and `\`) in `GitGraphLine`. In Git's `--graph` outputs, branch columns are separated by spaces (odd indices) while lines and nodes reside on even indices. Slashes/backslashes are transitions spanning from `index - 1` to `index + 1`. Adjusting both endpoints to these even column coordinates removes the 1-lane horizontal gap offset and connects lanes cleanly.

---

## [1.3.166] - 2026-06-30

### Fixed
- **Git Commit History: Node Line Connection Alignment**:
  - Replaced the faint `var(--tree-connector-color)` stroke on vertical lines passing through commit nodes (`*`) with the actual `laneColor`. This restores visibility of vertical connectors going to/from commit nodes, making curves and straights connect seamlessly in light and dark themes.

---

## [1.3.165] - 2026-06-30

### Changed
- **Git Commit History: Compact Visual Simplification**:
  - Reverted card-style feeds back to a standard flat, borderless list format with simple divider lines, reducing the item height and maximizing screen space.
  - Removed author avatar icons to clean up horizontal layout.
  - Removed SVG glow blur filters from the `visx` shapes to render crisp, solid, high-contrast branch lines.

---

## [1.3.164] - 2026-06-30

### Changed
- **Git Commit History: Visx Curve Model Only**:
  - Removed the link type selector button group from the panel header to keep the UI clean and clutter-free.
  - Locked the rendering logic to use exclusively the curved `LinkVertical` path (matching the core visual style of visx dendrograms) for all diagonal merge and branch lines.

---

## [1.3.163] - 2026-06-30

### Added
- **Git Commit History: Interactive visx Style Selector**:
  - Added a segmented control button group in the panel header allowing users to dynamically switch between **Curve** (cubic bezier), **Step** (orthogonal dendrogram-style), and **Line** (straight diagonals) rendering modes.
- **Git Commit History: Premium Visual Layout Redesign**:
  - Replaced the simple flat border list layout with a modern card-based timeline feed utilizing transparent glassmorphic backgrounds, rounded corners (`8px`), and custom border shadows.
  - Implemented dynamic hover micro-animations (cards lift upwards on hover with glowing border indicators).
  - Applied neon SVG drop-shadow filter glow on the visx connector tracks to create a glowing aesthetic in the graph columns.

---

## [1.3.162] - 2026-06-30

### Changed
- **Git Commit History: Full visx Migration & Alignment Corrections**:
  - Fully migrated all straight, diagonal, and horizontal lines in the visual commit graph rendering to use Airbnb's `@visx/shape` components (`LinkVertical` and `LinkHorizontal`).
  - Corrected the coordinate formula for backslash (`\`) lines to run from `index - 1` (top) to `index` (bottom), matching the actual branch offsets. This resolves the remaining gaps seen in multi-lane split and merge commits.

---

## [1.3.161] - 2026-06-30

### Changed
- **Git Commit History: Airbnb visx Integration**:
  - Replaced raw SVG paths for git slash (`/`) and backslash (`\`) connector lines with the `LinkVertical` component from Airbnb's `@visx/shape` library.
  - Retained exact pixel alignments and correct diagonal slope shift logic for seamless multi-row connection.

---

## [1.3.160] - 2026-06-30

### Fixed
- **Git Commit History: Visual alignment for SVG branch lines**:
  - Corrected the coordinate logic for slash (`/`) characters in `GitGraphLine`. Shifted the slope to go from bottom-left (`index - 1`) to top-right (`index`), allowing multiple diagonal merge paths to flow smoothly across row boundaries without gaps.
  - Aligned horizontal underscore (`_`) connectors to the bottom boundary of the row cell (`rowHeight - 1`) so they connect seamlessly with the bottom points of slashes and backslashes.

---

## [1.3.159] - 2026-06-30

### Changed
- **Git Commit History: Custom SVG Renderer**:
  - Replaced the character-based grid `div` renderer (`GitGraphLine`) with a modern, high-performance SVG drawing system.
  - Implemented smooth cubic bezier curves (`M ... C ...`) for diagonal slash (`/`) and backslash (`\`) lines, making branch splits and merges visually continuous.
  - Added support for straight SVG lines for vertical connectors (`|`) and horizontal lines (`_`).
  - Styled commit nodes (`*`) as SVG circles with a drop shadow glow matching the workspace theme accent.
  - Cleaned up unused React imports to pass TypeScript compilation checks.

---

## [1.3.158] - 2026-06-30

### Fixed
- **Git Commit History: Light Theme UI fixes**:
  - Replaced hardcoded dark background and border in the Git Graph column with transparent backgrounds and border variables, aligning it cleanly with the list layout.
  - Enabled the vertical connecting branch line to dynamically use `--tree-connector-color` instead of a hardcoded white alpha color, making branches clearly visible in Light Mode.
  - Added high-contrast branch references (badges like `main`, `remote`, `tag`) for the light theme, using darker texts and soft-colored backgrounds to improve readability.
  - Removed node glows and avatar shadows when the light theme is active.

---

## [1.3.157] - 2026-06-30

### Fixed
- **Light Theme: UI Shadows, Tooltips, Toasts and Sidebar Panels**:
  - Added CSS class `theme-light` to document root dynamically based on theme.
  - Eliminated box shadows, active glows, dot pulses, and resizer glows in light theme using CSS overrides.
  - Removed heavy shadows on `.sidebar` and `.right-sidebar` in light mode.
  - Updated the inline switcher style block in `SidebarContentPanel.tsx` to use CSS custom properties instead of hardcoded dark values.
  - Revamped style tags in `GitChanges.tsx` using CSS variables to correctly adjust inputs, textareas, and tabs in light theme.
  - Improved theme selection highlights and accent selectors in `SettingsModal.tsx` to remain visible and high contrast on light backgrounds.

---

## [1.3.156] - 2026-06-30

### Fixed
- **Light Theme: Global Color Token Fixes**:
  - Added 28 new light/dark adaptive semantic CSS custom properties to `useThemeAndFonts.ts` (`--surface-overlay`, `--surface-overlay-hover`, `--surface-overlay-active`, `--surface-inverse`, `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--tree-connector-color`, `--tab-active-bg/border/color`, `--tab-close-hover-bg`, `--tooltip-bg/border/text/title/path/branch`, `--toast-bg/border/text`, `--ws-dropdown-bg/border/shadow`, `--panel-header-bg`, `--sidebar-tabs-bg`, `--window-btn-hover-bg`).
  - **`components.css`**: Replaced hardcoded dark-only RGBA/hex values with semantic variables in: tab hover/active/close-hover, tab tooltip (background, border, text, title, path, branch), toast item (background, border, color, shadow), workspace dropdown menu (background, border, shadow), dropdown action button hover, workspace search bar (background, border), tree container border, tree connector pseudo-elements, and tree item hover.
  - **`layout.css`**: Replaced hardcoded RGBA values in sidebar panel tabs background, sidebar panel tab hover/active, panel section header background, and window control button hover.
  - **`base.css`**: Replaced hardcoded scrollbar thumb colors with CSS variable references with dark-mode fallbacks (`--scrollbar-thumb`, `--scrollbar-thumb-hover`).

---

## [1.3.155] - 2026-06-30

### Fixed
- **Connection Error Page: Light Theme Compatibility**:
  - Replaced all hardcoded dark-only color values with semantic CSS custom properties (`--btn-secondary-bg`, `--btn-secondary-border`, `--status-footer-bg`, `--heading-gradient-from/to`, `--icon-bg`, `--icon-border`).
  - Removed all `box-shadow` declarations (card shadow, primary button glow, icon inner shadow, status dot glow) so the page renders cleanly on light themes without dark halos or colored glows.
  - Added a light-theme override block in `applySavedTheme()` that overrides the semantic tokens with appropriate light values when `settings.theme === 'light'`.

---

## [1.3.151] - 2026-06-30

### Fixed
- **Git Changes: Bottom Diff Panel Hides When Opening as Tab**:
  - When `onFileOpen` is provided, clicking a file now immediately opens it as an editor tab and **does not show the inline diff panel** below the file list. The file is still highlighted in the list.
  - Previous behavior caused both the inline diff panel AND the tab to open simultaneously.
- **Git Changes: File Tab Now Visible in Tab Bar**:
  - Fixed `filteredTabs` in `App.tsx` to always include `file`-type tabs in the active worktree view. Previously, file tabs opened from the Git Changes panel could be hidden by the worktree filter even though they belonged to the workspace.
- **Git Changes: Improved Path Construction**:
  - `workspacePath` backslashes are now normalized to forward-slashes before concatenating with the git-relative `file.path`, producing a consistent forward-slash path for cross-platform compatibility.

---

## [1.3.150] - 2026-06-30

### Fixed
- **Filter Folders from Git Changes Panel**:
  - Fixed `getGitStatus` in `gitManager.ts` to exclude directory entries (paths ending with `/`) from git status output.
  - Folders (e.g. untracked `node_modules/`, `dist/`) will no longer incorrectly appear as changed items in the Git Changes sidebar.

---

## [1.3.149] - 2026-06-30

### Added
- **Open Changed Files as Editor Tab from Git Changes Panel**:
  - Clicking any file in the Git Changes sidebar (both Staged and Unstaged sections) now opens the file directly as an editor tab in the main view.
  - Added `onFileOpen` and `workspacePath` props to `GitChanges` component to resolve the full absolute file path and pass it to the tab opener.
  - Deleted files are excluded from tab-opening (no content to display).

---

## [1.3.148] - 2026-06-30

### Fixed
- **CustomSelect Theme Color Support**:
  - Replaced the hardcoded dark background `rgba(9, 12, 20, 0.95)` on the dropdown panel with a theme-aware `color-mix(in srgb, var(--bg-sidebar) 95%, transparent)` value.
  - The dropdown now correctly adapts its background color to the active theme (Dark, Nord, Light, etc.).

---

## [1.3.147] - 2026-06-30

### Fixed
- **Optimized CustomSelect Hover Performance**:
  - Prevented massive layout thrashing and hover lag by conditionalizing the DOM `scrollIntoView` call so that it only runs during keyboard navigation (i.e. arrow key presses or initially opening the selected option), and not during mouse hover movements.

---

## [1.3.146] - 2026-06-30

### Fixed
- **Optimized Settings Modal Tab Switching Performance**:
  - Moved font and weight options arrays outside the component's render function so they have stable object references, preventing unnecessary re-renders of the custom `<Select>` dropdown elements.
  - Refactored the connection-checking effect to fetch connections only when the "Access Control" tab is active, eliminating redundant background network requests and associated state-update lags during tab transitions.

---

## [1.3.145] - 2026-06-30

### Added
- **Premium Google Fonts in Appearance Settings**:
  - Imported a full suite of modern, premium Google Fonts in `index.html` (including Geist, Plus Jakarta Sans, Open Sans, Nunito, Sora, DM Sans, IBM Plex Mono, Inconsolata, Roboto Mono, Space Grotesk, Manrope, Work Sans, Cabin, Space Mono, and Anonymous Pro).
  - Updated `useThemeAndFonts.ts` to include these new fonts in the UI Font Family and Terminal Font Family choices in the Appearance settings.
  - Implemented fallbacks for `Geist Sans` to look for both the Vercel local name and Google Fonts name.

---

## [1.3.144] - 2026-06-30

### Fixed
- **Custom Select Integration in Sidebar**:
  - Replaced the native HTML `<select>` dropdowns in the left sidebar's File Explorer and Git Changes panels with the project's custom, premium `<Select>` component.
  - Added CSS style overrides in `components.css` to keep the custom Select dropdowns compact and beautifully integrated within the sidebar layout.

---

## [1.3.143] - 2026-06-30

### Added
- **Enriched VSCode-like Git Source Control Features**:
  - Integrated a premium **Git Commit History** panel showing recent commits alongside a visual **Git Graph** lane tree. Lanes are dynamically colorized to map branch structures clearly.
  - Implemented detail views for historical commits, displaying author metadata, date details, full commit body messages, and list of changed files.
  - Allowed side-by-side/inline diff previewing for any modified file in a historical commit.
  - Created a interactive **Branch Management & Sync** modal, allowing search/checkout of local branches, creation/checkout of new local branches, and remote pull/push sync actions.
  - Made the Footer's branch indicator pill hoverable and clickable to quickly toggle the Branch Management dialog.

---

## [1.3.142] - 2026-06-30

### Fixed
- **Dropdown Menu Visibility Fix**:
  - Moved the absolute-positioned tabs dropdown container outside the `.chrome-tabs-container` which has `overflow: hidden;` styling.
  - This prevents the dropdown switcher menu from being visually clipped/hidden behind the tab bar layout.

---

## [1.3.141] - 2026-06-30

### Added
- **Enforced Maximum Tab Limit in Tab Bar**:
  - Enforced a maximum limit of 7 visible tabs in the main tab bar.
  - Automatically moves overflow tabs into the dropdown switcher.
  - Dynamically includes the active tab as the last visible tab in the tab bar if it is selected from the dropdown list.

---

## [1.3.140] - 2026-06-30

### Fixed
- **Open Tabs Dropdown Button**:
  - Fixed open tabs dropdown instantly closing itself on click.
  - Implemented target checks using `closest()` to exclude dropdown button clicks from triggering auto-close.

---

## [1.3.139] - 2026-06-30

### Fixed
- **UTF-16LE File Encoding Auto-detection**:
  - Implemented auto-detection of UTF-16LE file encoding in `/api/fs/read` (checking BOM `0xFF 0xFE` and null-byte odd-index heuristics).
  - Correctly decodes UTF-16LE content to prevent spaced-out text rendering and red `NUL` character boxes inside Monaco editor.

---

## [1.3.138] - 2026-06-30

### Added
- **Copy Path Option in Workspace Explorer**:
  - Added "Copy Path" / "Copy Paths" options in the Explorer's context menu.
  - Copies absolute path (or newline-separated list for multi-selections) to the clipboard.
  - Displays a toast confirmation notification upon success.

---

## [1.3.137] - 2026-06-30

### Fixed
- **Footer Path display adjustment**:
  - Resolved active file paths to parent directories inside the footer to display containing folders exclusively.
  - Adjusted footer directory folder-opening context clicks to launch parent folders instead of raw file paths.

---

## [1.3.136] - 2026-06-30

### Added
- **Image Mouse Scroll-to-Zoom Support**:
  - Implemented mouse wheel scroll zoom handling on the image viewer tab.
  - Attached non-passive wheel event listener to container to intercept default scrolling and adjust zoom scale incrementally.

---

## [1.3.135] - 2026-06-30

### Added
- **Image Grab-to-Pan / Drag-to-Scroll Support**:
  - Implemented click-and-drag grabbing support to pan/scroll around zoomed images.
  - Tracked dragging coordinates globally and applied translation offset in the image transform.
  - Temporarily disabled transitions during dragging to ensure zero-latency movement.
  - Styled grab/grabbing cursor states dynamically.

---

## [1.3.134] - 2026-06-30

### Added
- **Tab Image & PDF Viewer Support**:
  - Implemented `/api/fs/raw` raw streaming backend endpoint for loading images and PDF contents directly.
  - Allowed query parameter authentication (`?token=...`) in `authMiddleware` for embedding resources.
  - Integrated a premium zoomable image viewer for images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico`) with checkerboard transparency background, smooth scaling animations, zoom out, zoom in, and reset options.
  - Integrated an iframe/embed viewer for PDF documents.

---

## [1.3.133] - 2026-06-30

### Added
- **Shift+Click Range Selection in Explorer**:
  - Implemented Shift+Click range selection support to select a sequence of visible files/directories in the Workspace Explorer.
  - Calculated visual range selection by query-selecting active elements in the tree-view viewport dynamically using a scroll container ref and DOM attributes.
  - Reset range anchor upon background deselect.

---

## [1.3.132] - 2026-06-30

### Added
- **Multi-select Files/Directories in Explorer**:
  - Added support for multi-selecting items in the Workspace Explorer by holding Ctrl/Cmd key while clicking.
  - Implemented visual highlighting (`explorer-item-active` class styling) for all selected items.
  - Updated context menu actions to support batch operations: opening multiple items in the native system file explorer, and deleting multiple items concurrently.
  - Extended the `ConfirmModal` warning message and title dynamically to reflect the count and names of selected items.
  - Added background click-to-deselect functionality to clear active selections.

---

## [1.3.131] - 2026-06-30

### Fixed
- **UI Deletion Confirmation Modal**: Replaced the native browser `window.confirm` dialog for Workspace Explorer item deletions with the application's native, glassmorphic `ConfirmModal` UI component.

---

## [1.3.130] - 2026-06-30

### Added
- **Workspace Explorer Right-Click Context Menu**:
  - Implemented a premium glassmorphic context menu for files and directories in the Workspace Explorer.
  - Added "Open in Explorer" / "Reveal in Explorer" to open the selected directory/file in the native OS file explorer (Windows Explorer, macOS Finder, or xdg-open on Linux).
  - Added "Delete" to recursively remove files and directories with confirmation prompts and reactive WebSocket reload events.
  - Refactored `FilePanel.tsx` by splitting the monolithic code into two new files (`FileExplorer.tsx` and `GitChanges.tsx`) to comply with the 1000-line limit rule.

---

## [1.3.129] - 2026-06-30

### Fixed
- **Terminal Copy/Paste on Text Selection**: Fixed an issue where Ctrl+C did not copy text when selection (blocking text) was active in the terminal.
  - Added an xterm custom key event handler to intercept Ctrl+C when there is an active selection and write the selected text to the clipboard.
  - Intercepted Ctrl+V to paste text from the clipboard via the WebSocket pty connection, supporting multi-line smart paste warnings.

---

## [1.3.128] - 2026-06-30

### Fixed
- **File Explorer and Git Changes Sync**: Fixed out-of-date File Explorer and Git Changes views when files are modified, created, or deleted.
  - Enhanced backend file watcher to recursively watch active worktree directories dynamically in addition to main workspace paths.
  - Added callback triggers to re-initialize file watchers when worktrees are added or removed.
  - Configured backend `/api/fs/write` to trigger immediate update notifications when files are saved in the Monaco editor.
  - Added a deep comparison helper in `useGitStatus` to prevent redundant explorer fetches during background polling.
  - Updated frontend `App.tsx` to automatically trigger file explorer tree refreshes whenever git status updates or files are saved.

---

## [1.3.127] - 2026-06-30

### Fixed
- **Monaco Editor CSS Blocked by CSP**: Added `https://cdn.jsdelivr.net` to the `style-src` directive in `frontend/index.html`. The Monaco editor stylesheet (`editor.main.css`) is loaded from jsDelivr at runtime and was being blocked because `cdn.jsdelivr.net` was only listed in `script-src` and `worker-src` but not in `style-src`.

---

## [1.3.126] - 2026-06-30

### Fixed
- **File Explorer Request Storm (`ERR_INSUFFICIENT_RESOURCES`)**: Fixed an infinite fetch loop in `FileExplorer` where the `onRefresh` callback prop (an unstable function reference from the parent) was included in the `useCallback` dependency array for `load`. Every parent re-render caused `load` to be recreated, which triggered its `useEffect`, which fired another fetch, which caused another re-render â€” resulting in hundreds of requests per second to `/api/fs/explore`. The fix moves `onRefresh` into a stable `useRef`, decoupling it from the dependency chain entirely.

---

## [1.3.125] - 2026-06-30

### Fixed
- **Insecure Content Security Policy Warning**: Added Content-Security-Policy (CSP) meta tags to both the main application (`index.html`) and the local fallback page (`connection-error.html`) to restrict scripts, styles, fonts, and WebSocket connections to trusted origins, with adjustments to allow Monaco Editor workers from jsDelivr and cdnjs CDNs.
- **Canvas Renderer Initialization TypeError**: Migrated all xterm.js dependencies from legacy unscoped packages (`xterm`, `xterm-addon-*`) to modern scoped package versions under the `@xterm/` namespace. This prevents duplicate xterm bundle instances and aligns types at runtime, allowing the canvas addon to initialize and render correctly.

---

## [1.3.124] - 2026-06-30

### Fixed
- **Tab Closing Focus Isolation**: Fixed a bug where closing the last tab of a workspace automatically switched the view to a different active workspace. Closing the last tab of a workspace now correctly keeps the focus on that workspace and displays the "Empty Dashboard" welcome screen as expected.

---

## [1.3.123] - 2026-06-30

### Added
- **Theme Synchronization to Reconnect & Restart Screens**:
  - Saved the user's active theme preset, accent color, and font choices to a local configuration file (`theme_settings.json`) in the Electron application data directory.
  - Preloaded and applied the saved theme variables dynamically on the offline reconnection screen (`connection-error.html`), updating body mesh gradients, window control buttons, titlebars, background cards, borders, fonts, and active accents.
  - Replaced hardcoded mesh gradient colors in both the main application (`base.css`) and reconnect screen with dynamic theme CSS variables (`--bg-radial-dot`, `--bg-radial-glow1`, `--bg-radial-glow2`).
  - Styled the primary action button (`Start Backend`) on the reconnect page using the active theme's accent color and custom shadows.

---

## [1.3.122] - 2026-06-30

### Added
- **Git Actions in Source Control Tab**:
  - Implemented stage, unstage, and discard changes for individual files directly from the Changes panel.
  - Added "Stage All", "Unstage All", and "Discard All" buttons in the Changes panel header.
  - Added a Commit section featuring a commit message text area with Ctrl+Enter keyboard shortcut support and a "Stage all & commit" option.
  - Grouped changes into explicit "Staged Changes" and "Changes" (unstaged) sections to align with professional Git client standards.
  - Added robust confirmation prompts before discarding changes to protect unstaged work from accidental deletions.
  - Refactored git backend endpoints to a separate express router file (`gitRoutes.ts`) to maintain a clean modular architecture and keep `server.ts` well under the 1000-line limit.

---

## [1.3.121] - 2026-06-29

### Added
- **Premium Custom Select Component**:
  - Implemented a custom glassmorphic select dropdown component with full keyboard navigation (arrows, Enter, Space, Escape) and click-outside closing behavior.
  - Added support for search/filtering, icons, and descriptions in options.
  - Replaced all native `<select>` dropdowns across the application with the custom select component, including `Modals.tsx` (workspace/branch/shell settings), `SettingsModal.tsx` (font families), `RightSidebar.tsx` (sidebar shell switcher), and `Footer.tsx` (status bar shell switcher with upward `'top'` alignment and `'minimal'` visual styling).
  - Added a search filter input directly inside the UI and Terminal font select dropdowns for quick font lookups.
  - Added several new premium UI and Monospace font variants, including `Geist Sans`, `SF Pro`, `Plus Jakarta Sans`, `Lato`, `Open Sans`, `Nunito`, `Sora`, `DM Sans`, `Geist Mono`, `SF Mono`, `Cascadia Code`, `IBM Plex Mono`, `Inconsolata`, and `Hack`.
- **Font Weight Control**:
  - Added `UI Font Weight` and `Terminal Font Weight` dropdowns in Settings (Light/Regular/Medium/Semibold/Bold).
  - UI font weight is applied globally to the app via `--font-sans-weight` CSS variable on the `body` element.
  - Terminal font weight is piped from `useThemeAndFonts` â†’ `App.tsx` â†’ `SplitLayoutRenderer` â†’ `TerminalInstance` and passed as `fontWeight` to Xterm.js, with live reactive updates.

---

## [1.3.120] - 2026-06-29

### Added
- **Real-time Workspace and Git Status Sync**:
  - Implemented recursive workspace file system watching using Node's native `fs.watch` to detect file additions, deletions, renames, and modifications.
  - Added debounced (300ms) WebSocket broadcast triggers on file changes to notify the client-side UI of changes.
  - Implemented cascading, state-preserving updates in the File Explorer tree view so that expanded folders automatically reload their updated contents without collapsing.
  - Automatically refreshes Git status changed files and badges in the sidebar when any file system changes are detected.

---

## [1.3.119] - 2026-06-29

### Added
- **Tabs Dropdown Switcher Menu**: Added a tab dropdown list switcher with a chevron-down icon next to the "New Tab" button in the tab bar. This dropdown appears when there are 2 or more active tabs, allowing the user to quickly view, switch between, or close tabs directly from the list.

---

## [1.3.118] - 2026-06-29

### Removed
- **Removed Branch Prefix from Tab Buttons**: Removed the inline git branch badge prefix (`master | `) inside the individual tab buttons in the tab bar for a cleaner and more compact interface.

---

## [1.3.117] - 2026-06-29

### Changed
- **Removed Branch Suffix from Tab Titles**: Removed the branch name suffix (` (branch)`) from terminal tab titles. Terminal tabs now display only the clean workspace name, while the branch name remains visible in the header and footer status indicators.

---

## [1.3.116] - 2026-06-29

### Changed
- **Workspace Card Non-Toggling Behavior**: Removed toggle-off deselection from parent workspace card clicks, ensuring that parent workspace selections remain persistent and always select their main branch (`master`/`main` via `ws.path`) unconditionally. Toggle-off deselection continues to work for sub-worktree items.

---

## [1.3.115] - 2026-06-29

### Changed
- **Workspace & Worktree Selection and Toggle-Off Behavior**:
  - Modified workspace parent card click behavior so that clicking a workspace directly selects its main branch (`master`/`main` via `ws.path`) instead of leaving the path unselected.
  - Implemented toggle-off (deselect) behavior: clicking an already selected workspace or worktree in the sidebar clears the selection (setting `panelWorkspace = null` and `panelWorktreePath = null`), hiding active workspace tabs and displaying a clean welcome dashboard.
  - Refactored `filteredTabs` and active tab synchronization in `App.tsx` to handle isolation of nested worktree paths when the main branch (`ws.path`) is selected.
  - Removed unused variable declarations to fix build compiler warnings.

---

## [1.3.114] - 2026-06-29

### Fixed
- **Sub-folder Worktree Path Sorting & Matching**:
  - Sorted worktrees by path length descending in `getTabGitBranch` (`useTabUiHandlers.ts`) to ensure specific nested worktrees (e.g. `.worktrees/*`) match before falling back to the main workspace path.
  - Applied the same descending path length sorting in the `Footer` helpers (`getWorkspaceActiveBranch` and `getRelativeActivePath`) to fix incorrect branch/path displays.
  - Refactored `WorkspaceList.tsx` active worktree highlighting logic (`isWtActive`) to prevent the main branch and sub-folder worktrees from being highlighted simultaneously.

---

## [1.3.113] - 2026-06-29

### Added
- **Bidirectional Tab and Sidebar Workspace/Worktree Synchronization**:
  - Implemented a `useEffect` hook in `App.tsx` utilizing a `useRef` to track previous tab state changes.
  - Automatically switches the active sidebar workspace and selected worktree branch when switching between tabs.
  - Automatically updates the sidebar context when a terminal shell's working directory (CWD) changes.
  - Automatically updates active terminal tab titles dynamically if the Git branch of the worktree changes.

---

## [1.3.112] - 2026-06-29

### Fixed
- **Worktree Active Highlight Styling in Sidebar**:
  - Propagated the `panelWorkspace` prop down to the `WorkspaceList` and `WorktreeList` components.
  - Fixed active workspace card highlighting by tracking both tab active state and user-selected workspace panel state (`panelWorkspace?.id === w.id`).
  - Corrected `isSelectedWt` logic in the worktree list so that the main branch is highlighted when `panelWorktreePath` is null (representing the main workspace view) only for the active workspace.

---

## [1.3.111] - 2026-06-29

### Added
- **Worktree Header & Footer Synchronization**:
  - Integrated `panelWorktreePath` into `Footer` to display the selected worktree's branch name and relative directory path even when there are no active tabs or when the active tab path is not in the worktree.
  - Added a persistent worktree branch badge (`.tab-group-badge`) at the start of the Integrated Tab Bar when in worktree filtering mode.
  - Pass `panelWorktreePath` to `EmptyDashboard` so that clicking the "Open Terminal" button opens the shell directly within the active worktree directory.

---

## [1.3.110] - 2026-06-29

### Changed
- **Worktree Folder Naming**: Renamed default folder for workspace worktrees from `.worktree/` to `.worktrees/` (plural) based on user preference.

---

## [1.3.109] - 2026-06-29

### Changed
- **Default Worktree Folder Location**: Changed the default base directory for new git worktrees to be created inside a `.worktree` folder within the workspace root itself (e.g., `<workspace-path>/.worktree/<branch-name>`) instead of a sibling folder.
- **Dynamic Path Synchronization**: Added a `useEffect` hook in `useWorkspaces.ts` to dynamically sync the default worktree checkout path segment to match the typed or selected branch name in real-time.

---

## [1.3.108] - 2026-06-29

### Added
- **Branch Name Input Sanitization**: Automatically sanitize input values for new branch names and custom local branch names in the "Create Git Worktree" modal, converting whitespace to hyphens and stripping special characters invalid in Git reference formats.

---

## [1.3.107] - 2026-06-29

### Added
- **Custom Local Branch Name for Existing Branches**: Added an optional text input in the "Create Git Worktree" modal allowing users to define a custom local branch name when tracking an existing remote or local branch.

---

## [1.3.106] - 2026-06-29

### Added
- **Detached HEAD Fallback for Worktrees**: Added a fallback in `addWorktree` that automatically attempts to use `--detach` when a branch (like `master`) is already checked out by another worktree, preventing `fatal` check out conflicts.

---

## [1.3.105] - 2026-06-29

### Changed
- **Worktree Selection Behavior**: Clicking on a worktree in the sidebar now specifically targets, opens, or switches to a terminal tab configured for that worktree path instead of opening or activating file tabs.

---

## [1.3.104] - 2026-06-29

### Added
- **Worktree Active Branch Integration**:
  - Integrated file explorer (`FileExplorer`) and git changes (`GitChanges`) to automatically load directories and git status / diffs matching the active worktree selection.
  - Added support in backend workspace git status and diff routes to process a `worktreePath` parameter.

### Fixed
- **Null/Undefined Safeguards**: Safeguarded all workspace worktree loops and checks to fall back safely to an empty array when uninitialized, preventing browser runtime crashes.
- **React Hook Rules**: Fixed React Error #310 by moving the `filteredTabs` `useMemo` definition above the early return conditions inside `App.tsx`.

---

## [1.3.103] - 2026-06-29

### Added
- **Worktree Filtering & Grouping**:
  - Filter tabs in the top tab bar to only display active worktree tabs when a specific worktree branch is selected.
  - Display all tabs grouped/sorted by worktree branches with a beautiful themed `.tab-group-badge` in the top bar when the parent workspace itself is clicked.
  - Automatically sync the active worktree selection when switching tabs.
  - Removed the active checkmark icon from active worktree tree items in the sidebar list (retaining the selection highlight), while keeping the checkmark on the main workspace tree item layout.

---

## [1.3.102] - 2026-06-29

### Added
- **Appearance Settings**: Added an "Appearance" tab inside the SettingsModal allowing rich customization of themes, colors, and fonts:
  - **Theme Presets**: Switch between *Default Dark*, *Dracula*, *Cyberpunk Neon*, *Forest Green*, *Nord Frost*, and *Light Mode*.
  - **Color Customization**: Choose from 7 curated accent colors or specify any custom color using a native color picker. Accent colors dynamically derive states like glows, borders, shadows, and radial grid backgrounds via CSS `color-mix()`.
  - **UI Font Selection**: Customize the main UI font family (Outfit, Inter, or System Default). Loaded new font families via Google Fonts in `index.html`.
  - **Terminal Font Selection**: Customize the terminal/editor font family (JetBrains Mono, Fira Code, Source Code Pro, Courier New, or System Monospace).
  - **Terminal Font Size Settings**: Control the terminal font size dynamically through a range slider.
  - **Unified xterm.js styling**: Updated terminal instances to dynamically update font families, cursor colors, selection backgrounds, and theme colors on changes.

---

## [1.3.101] - 2026-06-29

### Removed
- **Model Context Protocol (MCP)**: Cleaned up and completely removed the MCP Server integration, SSE/WS endpoints, proxy stdio bridge, and MCP Settings dashboard/logs panel from both the frontend and backend.

---

## [1.3.100] - 2026-06-29

### Refactored
- **Code Modularization (App.tsx)**: Refactored the core frontend `App.tsx` file to bring it fully under the strict 1,000-line repository limit (reduced from 1,028 lines to 938 lines):
  - Extracted workspace/worktree actions and tab interaction logic to a new custom hook `useWorkspaceHandlers.ts`.
  - Extracted unified confirmation and alert dialog state management to a new custom hook `useConfirmDialog.ts`.
  - Extracted active workspace git status polling and state management to a new custom hook `useGitStatus.ts`.
  - Extracted the static inline SVG `TPlusLogo` component to its own file `TPlusLogo.tsx`.
  - Extracted `TabTooltip` and `TabContextMenu` components to a dedicated file `TabUiComponents.tsx`.

---

## [1.3.99] - 2026-06-29

### Added
- **Model Context Protocol (MCP) Server**: Exposes workspace data, file operations, git worktrees, and terminal execution capabilities directly to external AI assistants.
  - Implemented custom JSON-RPC 2.0 message processor and SSE endpoints (`/api/mcp/sse`, `/api/mcp/message`).
  - Added 7 specialized tools: `list_workspaces`, `get_workspace_details`, `run_command`, `read_file`, `write_file`, `create_worktree`, and `remove_worktree`.
  - Enforced security filters verifying that all file operations and command executions reside strictly inside configured workspaces.
  - Protected endpoints by requiring active session token validation.
- **MCP Stdio Proxy Bridge**: Created a lightweight stdio-to-WebSocket proxy (`mcp-stdio.ts`) allowing stdio-only clients like Claude Desktop to bridge directly into the running backend.
- **MCP Dashboard & Settings Tab**: Designed a premium, interactive tab inside the `SettingsModal` displaying connection status, active client stats, copy-paste config guides for Claude Desktop and Cursor, and a live-updating audit log of tool calls.

---

## [1.3.98] - 2026-06-29

### Added
- **Terminal Active Processes Loading & Badges**: Added active process monitoring to the workspace list and branch list.
  - Implemented OS process tree scanning (`getActiveProcessesForPid`) on Windows/Unix in `terminalManager.ts`.
  - Added a 2.5s interval in WebSocket title polling to check active child processes and push the list to client.
  - Rendered a glowing pulsing green dot overlapping workspace and worktree icons when a terminal has active commands running.
  - Added beautiful styled gradient glow badges next to workspace/worktree items for specific processes (Claude Code, Gemini CLI, Cursor, Superagent CLI, and general "Active" processes).

---

## [1.3.97] - 2026-06-29

### Refactored
- **Code Modularization (App.tsx)**: Refactored the core frontend `App.tsx` file to improve maintainability and strictly conform to the 1,000-line limit:
  - Extracted update checking and GitHub release checks to a new custom hook `useUpdateChecker.ts`.
  - Extracted tab context menus, tooltips, and tab closure actions to a new custom hook `useTabUiHandlers.ts`.
  - Extracted authentication lifecycle, login, and setup checks to a new custom hook `useAuth.ts`.
  - Reduced `App.tsx` file size from 1,582 lines to 1,222 lines.

---

## [1.3.96] - 2026-06-29

### Fixed
- **Workspace & Branch Badges Out-of-date**: Fixed a bug where workspace cards and worktree branch dirty count badges were never updated after initial load. Added periodic workspace list polling (every 10 seconds) in the frontend.
- **Save Refetch & Cache Invalidation**: Saving a file in the code editor now triggers an immediate workspace refresh in the frontend. Also, the backend file write endpoint `/api/fs/write` now automatically clears the workspace status cache to ensure the badges update instantly.
- **Type Safety**: Fixed a TypeScript compilation error in `FileViewerTab.tsx` regarding implicit `any` type for Monaco model iterator.

---

## [1.3.95] - 2026-06-29

### Added
- **Git Spawning Optimization (RAM & CPU)**: Added an 8-second memory caching mechanism to `getWorkspaceInfo` in the backend. Since the Electron app polls workspace info every 5 seconds, this completely stops the backend from constantly spawning slow and resource-heavy `git status` and `git worktree list` child processes in the background. The cache is automatically cleared when workspaces or worktrees are added, removed, or updated.

---

## [1.3.94] - 2026-06-29

### Added
- **RAM Optimization**: Implemented several memory optimizations to reduce the footprint of Electron, Node, React, and terminal sessions:
  - Added `--max-old-space-size=384` js-flags to Electron to restrict V8 heap size in main/renderer processes.
  - Enabled GPU command buffer pruning on idle.
  - Limited the Node.js backend utility process memory limit to `192MB`.
  - Disposed of Monaco Editor models on tab unmount/file change to prevent memory leaks.
  - Reduced terminal scrollback history from 10,000 to 3,000 lines.
  - Halved the PTY session output buffer limit to 64KB.

---

## [1.3.93] - 2026-06-29

### Fixed
- **System Tray PTY Sessions**: Fixed an issue where the tray menu would not update when terminal sessions changed due to the polling loop ignoring identical status updates.
- **Git Worktree Support in Tray**: Updated session-to-workspace mapping to look up git worktree paths in addition to main workspace paths. Submenu items for terminal sessions in a worktree now explicitly indicate the active worktree's branch.

---

## [1.3.92] - 2026-06-29

### Fixed
- **CI Build & Release**: Removed the redundant `softprops/action-gh-release@v2` step from `release.yml`. Since `electron-builder` already publishes and uploads all built binaries and updater metadata files when `GH_TOKEN` is present, the extra upload step was duplicate and resulted in double-uploaded files with space-spaced and hyphenated names.

---

## [1.3.91] - 2026-06-29

### Fixed
- **CI Build Fix**: Reverted workflow back to the original simple structure without native builder rebuild workarounds (removed `electron-rebuild` and extra python setup steps that caused lockfile/compromised conflicts during npm execution), letting `electron-builder` natively handle compiling `node-pty`.

---

## [1.3.90] - 2026-06-29

### Fixed
- **CI Build Fix**: Overhauled GitHub Actions `release.yml` to properly handle native module compilation across all platforms:
  - Added `setup-python@v5` (Python 3.11) required by `node-pty` native build
  - Added Linux build tools (`build-essential`, `libx11-dev`, `libxkbfile-dev`, `libsecret-1-dev`)
  - Added macOS Xcode CLI tools setup
  - Added `electron-rebuild` step to rebuild `node-pty` against the correct Electron ABI
  - Added `fail-fast: false` so all 3 platform jobs run independently
  - Added `GH_TOKEN` env for `electron-builder` publish step

---

## [1.3.89] - 2026-06-29

### Fixed
- **Build Fix**: Removed unused `React` import in `UpdateNotification.tsx` that caused a TypeScript `TS6133` error and broke the GitHub Actions CI build on all platforms.

---

## [1.3.88] - 2026-06-29

### Added
- **Manual Update Check in Settings**: Added a "Software Update" row in the Settings â†’ General tab with a **Check** button that triggers `electron-updater` to immediately check GitHub Releases for a new version. The row displays contextual status badges: *Checkingâ€¦* (spinner), *Up to date* (green checkmark), *vX.X.X available* (purple), *Downloadingâ€¦ N%* (blue), and *Failed* (red with tooltip). When an update is downloaded and ready, the button becomes **Restart & Install vX.X.X**, directly triggering `quitAndInstall`. The row is only rendered inside the Electron desktop environment (hidden in browser).

---

## [1.3.87] - 2026-06-29

### Added
- **Auto-Update System**: Implemented a full end-to-end auto-update system powered by `electron-updater`. The app now automatically checks GitHub Releases for a newer version 5 seconds after startup and every 4 hours thereafter. Downloads happen silently in the background. A non-intrusive floating toast notification (bottom-right) informs users when an update is available, shows a real-time download progress bar (with speed and size info), and presents a "Restart & Install" button when the update is ready. Users can dismiss the toast or manually retry on error. The system is a no-op in development mode.

---

## [1.3.86] - 2026-06-29

### Changed
- **Minimalist Welcome Dashboard**: Redesigned the Empty Dashboard welcome page to be sleek and minimalist: removed the heavy colorful background gradients and glow behind the card; removed the pulsing animation (`animate-pulse`) from the primary CTA button and the Folder icon; simplified the card layout with a clean border (`border-white/5`) and a subtle dark-slate background (`bg-[#090c14]/40`).

---

## [1.3.85] - 2026-06-29

### Added
- **Deletion Loading Skeletons & Success Toasts**: Integrated real-time visual feedback when removing workspaces or worktrees. Displays a responsive, non-interactive loading card skeleton with red border highlights, pulse animations, and spinning loaders for workspaces, and a matching tree connector loading node for worktrees. Dispatches user-facing success notifications (`tline-toast` events) upon completion.

---

## [1.3.84] - 2026-06-29

### Changed
- **Minimalist Header Height & Control Pill Design**: Reduced desktop top-bar height (`--topbar-height`) from 56px to 40px to maximize vertical editor/terminal space. Eliminated the solid dark wrapper background and border on the right action control pill. Separated application action buttons (Help, Settings, Logout) from window actions (Minimize, Maximize, Close), styling them as borderless transparent icons that blend seamlessly into the header background.

---

## [1.3.83] - 2026-06-29

### Changed
- **Footer Status Bar Layout Reorganization**: Relayouted footer items into cleaner, logically grouped sections: Left Section displays metadata (application version and the RAM resource usage statistics pill); Center Section groups active Workspace directory context, active Git branch status badge, and terminal font zoom & shell selection controls; Right Section is dedicated to Cloudflare Tunnel status, URL, and actions. This prevents screen crowding when tunnels are active or workspace paths are long.

---

## [1.3.82] - 2026-06-29

### Added
- **Real-time Memory (RAM) Usage Widget in Footer**: Implemented memory diagnostics directly into the bottom status bar footer. Displays the RAM consumption for the Backend process (`B: XX MB`) and Desktop application (`D: XX MB`, aggregating memory working set size across all Electron processes). Added a detailed hover dropup tooltip showing complete memory breakdown (RSS and Heap memory for the Backend process, App Total and Main Process RSS for Desktop, and Free/Total Host System Memory). Added `/api/system/stats` backend endpoint and Electron main process IPC handler `get-memory-usage` to safely fetch these values.

---

## [1.3.81] - 2026-06-29

### Fixed
- **Monorepo Packaging & Internal Asset Resolution**: Resolved a major packaging issue where external `backend` and `frontend` assets were excluded from compiled builds due to `electron-builder` limitations. Created a cross-platform asset copying pipeline (`copy-assets.js`) to move assets inside the `desktop` workspace directory before compilation. Rewrote `projectRoot` resolution to use `app.getAppPath()` to guarantee path correctness, allowing the utility process to execute directly from within the `app.asar` archive and resolve production dependencies seamlessly.

---

## [1.3.80] - 2026-06-29

### Fixed
- **Portable Build Backend Spawning (utilityProcess)**: Resolved a critical uncaught exception (`Error: spawn ... ENOENT`) that occurred exclusively in packaged portable builds. Migrated the backend process spawning mechanism from manual OS execution via `child_process.spawn(process.execPath)` to Electron's official `utilityProcess.fork` API. This leverages Electron's internal helper process architecture, preventing file permission/existence failures under the temporary directories used by portable NSIS wrappers.

---

## [1.3.79] - 2026-06-29

### Fixed
- **Unpacked Physical Path & Shell Escape Resolution**: Resolved backend startup failure in packaged builds caused by Windows cmd shell whitespace splitting in directories containing spaces. Re-enabled `asarUnpack` for `backend/**/*` inside `desktop/package.json` to generate clean physical file locations, configured `desktop/main.js` to dynamically map `projectRoot` to `app.asar.unpacked`, and disabled `shell` spawning for binary executables in production. This guarantees backend processes spawn seamlessly under any folder path.

---

## [1.3.78] - 2026-06-29

### Optimized
- **Monorepo Bundle Size & Hoisting Resolution**: Fixed a critical packaging issue where backend dependencies (like `express`, `ws`, and `node-pty`) were missing from the production package because of npm workspaces hoisting. Declared the backend production dependencies directly inside `desktop/package.json`. This prompts `electron-builder` to bundle only the required production dependencies and automatically exclude all heavy `devDependencies` (like `typescript`, `ts-node-dev`, and types), resolving execution crashes on clean systems and optimizing the bundle size.

---

## [1.3.77] - 2026-06-29

### Fixed
- **Production Backend Executable Spawning**: Fixed backend initialization failure in packaged production builds. Reconfigured the spawn command in `desktop/main.js` to run the backend inside Electron's runtime (`process.execPath`) using `ELECTRON_RUN_AS_NODE=1` environment mode to guarantee ABI compatibility for native modules. Added `asarUnpack` configuration for `backend/**/*` inside `desktop/package.json` to prevent executable path loading blocks under the ASAR archive.

---

## [1.3.76] - 2026-06-29

### Fixed
- **Single Instance Focus Lock**: Integrated Electron `requestSingleInstanceLock` and `second-instance` event handlers in `desktop/main.js`. This resolves the issue where opening the executable again when it was already running in the background (minimized to the tray) did not show the window, by immediately focusing and restoring the existing application instance.

---

## [1.3.75] - 2026-06-29

### Fixed
- **Linux Packaging Metadata Validation**: Added required packaging fields (`author`, `homepage`, and `maintainer`) inside `desktop/package.json` to resolve build failures for Debian/Linux targets on GitHub Actions.

---

## [1.3.74] - 2026-06-29

### Added
- **Dynamic System Update Checker**: Integrated an automatic update checker. Added `/api/system/version` backend endpoint to read the application version dynamically, and configured the frontend to compare it against the latest GitHub release and show toast notifications and highlighted warning badges with direct download links in the UI.

---

## [1.3.73] - 2026-06-29

### Added
- **Multi-Platform CI/CD Release Workflow**: Created a GitHub Actions workflow `.github/workflows/release.yml` that builds and compiles Windows, macOS, and Linux releases in the cloud automatically.
- **macOS & Linux Build Configurations**: Added new build targets for `mac` (`dmg`, `zip`) and `linux` (`AppImage`, `deb`) to the `desktop` configurations.

---

## [1.3.72] - 2026-06-29

### Changed
- **Documentation Overhaul**: Redesigned and rewrote the primary project README to emphasize marketing appeal, highlighting key value propositions, user pain points solved, high-performance GPU Canvas rendering, and Git Worktrees workflow benefits. Added the visual application preview showcase in the documentation.

---

## [1.3.71] - 2026-06-29

### Fixed
- **Workspace Actions Dropdown Overlap**: Fixed a CSS stacking context bug where subsequent workspace cards overlapped and obscured the open dropdown menu of preceding workspace cards. Lifted the dropdown menu's open state to the parent `WorkspaceList` component and introduced a conditional `.ws-card-dropdown-open` class that sets a higher `z-index` (50) on the active card, ensuring the dropdown menu renders on top of all sibling cards.
- **Single-Dropdown Policy**: Managing the open dropdown state in the parent ensures only one workspace dropdown can be open at a time, automatically closing any open dropdown when another is toggled.

---

## [1.3.70] - 2026-06-29

### Added
- **xterm â€” Canvas GPU Renderer**: Terminal now uses `@xterm/addon-canvas` Canvas-based renderer instead of the default DOM renderer, delivering significantly smoother scrolling and rendering, especially during rapid streaming output from AI agents and build logs.
- **xterm â€” Image Protocol Support**: Added `@xterm/addon-image` enabling inline image rendering in the terminal via sixel and iTerm2 inline image protocol. CLI tools that output images (e.g., `viu`, image previews) will now render inline.
- **xterm â€” Terminal Status Bar**: A compact translucent status bar now appears at the bottom of each terminal pane showing: shell type (PS/CMD/Bash/etc.), WebSocket connection dot (green/red), cursor position (col:row), font size, and inline zoom in/out and clear/search buttons.
- **xterm â€” Premium Context Menu**: Right-click context menu redesigned with icons for each action, keyboard shortcut hints (Copy, Paste, Select All, Findâ€¦, Clear), scale-in animation, and a distinct danger style for destructive actions.
- **xterm â€” Smart Paste Warning**: Pasting 3 or more lines now shows an inline confirmation dialog with a preview of the content, preventing accidental multi-line pastes in interactive shells.
- **xterm â€” Upgraded Search Bar**: Search overlay now uses a slide-down animation, a grouped input wrapper with search icon, better visual toggle buttons for case-sensitive and regex modes, and distinct red styling when no results are found.
- **xterm â€” Split Pane Focus Ring**: In split-pane layouts, the currently focused terminal pane is highlighted with a violet glow border animation, making it immediately clear which pane is active.
- **xterm â€” Zoom from Status Bar**: Zoom in/out buttons in the status bar fire a `tline-zoom` custom event, wired to the same zoom handlers as keyboard shortcuts, so font size can be adjusted directly from the terminal bar.
- **xterm â€” Custom Mouse Cursor**: Changed the default mouse cursor inside the terminal screen from the `text` I-beam selector to a standard `default` arrow pointer. This makes mouse interaction feel natural in interactive TUI apps (e.g. Ink TUI interfaces with hover states), while still allowing dynamic overrides to `pointer` when hovering web links.

---




### Changed
- **Workspace Panel â€” Branch Collapse**: Branch/worktree list per workspace is now collapsed when there are more than 3 entries. A "+N more branches" toggle button appears to expand/collapse the full list, keeping the panel compact.
- **Workspace Panel â€” Compact Card Design**: Workspace cards are now more minimal with tighter padding, smaller font sizes, and less vertical gap. Replaced the old ad-hoc Tailwind utility classes with dedicated `.ws-card`, `.ws-card-active`, `.ws-card-dirty`, and `.ws-card-idle` CSS classes.
- **Workspace Panel â€” Search Bar**: Added a real-time search input at the top of the workspace list. Filters workspaces by name or path as you type, with a clear (Ã—) button and focus highlight.
- **Workspace Panel â€” Dirty-First Sort**: Workspaces with uncommitted changes (dirty worktrees) are automatically sorted to the top of the list so they are immediately visible without scrolling.
- **Workspace Panel â€” Dirty Count Pill**: If a workspace has uncommitted changes, a compact amber badge showing the total dirty file count is now displayed inline next to the workspace name.

---

## [1.3.68] - 2026-06-28

### Fixed
- **ANSI Black Color Invisible in Terminal**: The xterm.js theme had `black` set to `#1e293b` (near-identical to the `#000000` terminal background), making any program output using ANSI color 0 completely invisible. Changed `black` to `#4a5568` and `brightBlack` to `#718096` so all 16 ANSI colors are clearly readable on the dark background.

---

## [1.3.67] - 2026-06-28

### Fixed
- **Worktree Delete Backend Fallback**: If `git worktree remove --force` still fails with a Permission Denied/lock error (e.g. held by antivirus or File Explorer), the backend now falls back to: (1) clear read-only flags on all files in the directory, (2) force-delete the folder tree via `fs.rmSync`, then (3) run `git worktree prune` to clean up Git's internal registry. This ensures the worktree is always fully removed even when Git itself cannot acquire the necessary file lock.

---

## [1.3.66] - 2026-06-28

### Fixed
- **Worktree Delete Permission Denied**: When removing a git worktree, the app now automatically closes all terminal tabs and file tabs whose path is inside that worktree **before** issuing the backend delete command. This releases any OS-level file locks held by open terminal processes, preventing the `Permission denied: failed to delete '<path>'` error on Windows.

---

## [1.3.65] - 2026-06-28

### Changed
- **Enlarged Sidebar Logo**: Increased the `TPlusLogo` component size in the sidebar header to 28px (up from 22px) for a much clearer and more prominent visual presence.

---

## [1.3.64] - 2026-06-28

### Changed
- **Taskbar Icon White Background Fix**: Generated a new high-quality `T+` PNG icon with a solid dark indigo background (#0f172a) filling the entire 512x512 canvas. This replaces the transparent-corner version to prevent Windows from rendering white backgrounds in the corners.
- **Sidebar Header Logo Scaling**: Increased the size of the inline vector `TPlusLogo` SVG component inside the sidebar header from 16px to 22px for better readability and a more premium, balanced appearance.

---

## [1.3.63] - 2026-06-28

### Changed
- **Unified Sidebar Brand Logo**: Replaced the generic Lucide terminal icon in the sidebar header with the inline vector `TPlusLogo` SVG component, unifying the app UI branding with the taskbar and system tray icons.

---

## [1.3.62] - 2026-06-28

### Added
- **T+ SVG and PNG Logo**: Designed and wrote a scalable vector graphics (SVG) version of the brand logo at `desktop/icon.svg`, and generated a matching premium high-resolution `T+` PNG at `desktop/icon.png` for unified tray and taskbar support.

---

## [1.3.61] - 2026-06-28

### Added
- **Premium Application Icon Asset**: Created a custom premium glowing purple developer logo featuring a stylized 't' merging with a Git branch/terminal line, replacing `desktop/icon.png` to serve as the unified icon for both the taskbar/window and the system tray.

---

## [1.3.60] - 2026-06-28

### Changed
- **Accidental Closure Prevention for Small Tabs**: Added a CSS container query so that when tabs shrink in width (under 75px), the close button is completely hidden on hover for inactive tabs. This avoids accidental clicks and exactly matches Google Chrome's tab behavior.

---

## [1.3.59] - 2026-06-28

### Added
- **Dirty Files Count Badge**: Added an amber number badge next to dirty git branches/worktrees in the sidebar tree view, showing the exact count of uncommitted changes/untracked files.

---

## [1.3.58] - 2026-06-28

### Fixed
- **Stuck Tooltip Bug**: Fixed custom tab tooltips occasionally getting stuck on the screen when a tab is closed, clicked, or when a context menu is open. Added an automatic cleanup effect based on active tabs list changes.
- **Context Menu Interaction**: Prevented event bubbling on tab and terminal right-clicks, and registered window listeners for `contextmenu` to close open menus when right-clicking elsewhere.

---

## [1.3.57] - 2026-06-28

### Added
- **3-Strikes Tunnel Login Protection**: Restricted failed login attempts from external tunnel requests (Cloudflare Tunnels or other external proxy headers) to a maximum of 3. If exceeded, the offending IP address is automatically blocked.
- **Login Block List UI**: Added a dedicated section under the settings modal's Access Control tab, displaying real-time blocked login attempts with metadata (timestamp and failed attempts) and direct "Unblock" action support.

### Changed
- **Modals Codebase Refactoring**: Extracted and separated the `SettingsModal` code into [SettingsModal.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SettingsModal.tsx) to improve modularity and adhere strictly to the 1000-line file length limit.

---

## [1.3.56] - 2026-06-28

### Added
- **Backend Reconnection & Control Dashboard**: Implemented a beautiful, self-contained connection error page that is displayed in the desktop window whenever the backend service is stopped, starting, or fails to respond.
- **Automated Reconnect Ping**: The error page automatically check/pings the local backend server every 2 seconds via native Electron IPC handlers, automatically reloading the main app once the connection is restored.
- **Direct Backend Window Controls**: Enabled starting, restarting, and manual retrying of the local backend service using action buttons directly inside the Electron window, synced with real-time status updates from the main process.

---

## [1.3.55] - 2026-06-28

### Added
- **Chrome-Like Shrinking Tabs**: Added flexible shrinking layouts for terminal and file tabs in the topbar tab list. When many tabs are open, they dynamically shrink down in width (down to 36px), hiding inactive close buttons and labels gracefully.
- **Sleek Custom Tooltips**: Implemented custom floating glassmorphic tooltips containing the full tab name/type and working directory/file path when a tab is hovered or clicked.

## [1.3.54] - 2026-06-28

### Fixed
- **Inactive Workspace Main Branch Icon Color**: Ensured that the `GitBranch` icon for the `main` branch of an inactive workspace is rendered in gray (`text-slate-500`) instead of purple. This aligns it with the gray/slate color of the inactive branch name text, preventing inactive workspaces from appearing partially selected.

## [1.3.53] - 2026-06-28

### Changed
- **Selected Workspace Coloring Consistency**: Prioritized active/selected workspace styling (purple) over git dirty status coloring (amber) in `WorkspaceList.tsx`. The active/selected workspace will now always remain consistently purple, while other inactive workspaces will turn amber when they have uncommitted changes.

## [1.3.52] - 2026-06-28

### Removed
- **Blinking Git Dirty Status Dots**: Removed the redundant blinking amber/orange dots next to git branch names in the workspace sidebar list and footer. Dirty status continues to be indicated by the text and branch icon turning amber.
- **Blinking Version Dot**: Removed the blinking animation from the purple application version indicator in the footer and updated the hardcoded version text from `v1.3.42` to the current "version": "1.3.178".

## [1.3.51] - 2026-06-28

### Fixed
- **Terminal Grid Sizing Sync**: Resolved an issue where clicking and scrolling in interactive TUI applications (like `superagent`) did not work or was misaligned.
  - Added resize execution to backend `init` message handler, ensuring that re-attaching/opening a terminal updates the PTY grid size to match the frontend `xterm.js` viewport.
  - Adjusted frontend `TerminalInstance` initialization to call the initial `debouncedFit` after registering the `onResize` listener, capturing and sending the initial grid dimensions to the PTY backend.

## [1.3.50] - 2026-06-28

### Fixed
- **Mobile Keyboard Auto-Popup**: Stopped the virtual touch keyboard from automatically opening when tapping/clicking inside the terminal area on mobile. The keyboard now only opens when explicitly toggled using the dedicated Keyboard icon in the top-bar.

## [1.3.49] - 2026-06-28

### Fixed
- **Terminal Workspace/Tab Switch Freeze**: Fixed a bug where switching workspaces/tabs while running a highly active CLI tool (like `agy` or `claude code`) in a terminal causes the React UI to freeze.
  - Implemented a `suspend` message to temporarily detach the terminal session sender on the backend when its tab is unmounted, keeping the PTY process and buffer alive in the background without wasting network bandwidth and CPU.
  - Added a `removeListener` method to the WebSocket client to clean up message handlers.
  - Properly nullified `terminalRef.current` in the cleanup function of `TerminalInstance` to ensure any queued requestAnimationFrame writes return early instead of attempting to write to a disposed terminal.

## [1.3.48] - 2026-06-28

### Changed
- **Version Bump**: Bumped version to `1.3.48`.

## [1.3.47] - 2026-06-28

### Added
- **Workspace Edit Settings Feature**: Added capability to edit existing workspace configurations directly from the workspace list.
  - Users can now change the **Default Terminal Shell** and configure an optional **Custom Display Name** for any workspace.
  - Added `PUT /api/workspaces` backend endpoint to update workspace configurations.
  - Added a new `<WorkspaceEditModal>` settings dialog.
  - Added a settings edit button in the workspace list (and the mobile actions dropdown).

## [1.3.46] - 2026-06-28

### Added
- **Unified Custom Confirm/Alert Modals**: Replaced all browser-native `alert()` and `confirm()` prompts with a clean, unified custom `<ConfirmModal>` component to keep design consistency and premium dark mode experience.
  - Modals support custom titles, custom messages, customizable confirm/cancel action labels, and theme variants (e.g. Danger red for deletion).
  - Native confirmation requests (like Workspace or Worktree deletions) and API errors now display in the new modal.

## [1.3.45] - 2026-06-28

### Changed
- **Sleek Session Re-attached Toast**: Replaced the annoying raw `[t-line: Session Re-attached]` terminal text stream with a clean, responsive bottom toast notification.
  - Desktop/Tablet: Displays at the bottom-left corner above the status bar.
  - Mobile: Displays at the bottom-center.
  - Automatic dismissal after 3 seconds with smooth slide-up and fade-out animations.

## [1.3.44] - 2026-06-28

### Added
- **Git Status Badges on Changes Tab**: Added real-time changed files count badges to the Git Changes tab button. When the sidebar is expanded, a count pill is displayed; when the sidebar is collapsed, a small circular notification badge is displayed on the top right of the GitCompare icon.
- **Git Status Badges in Workspace Explorer**: Files and folders in the workspace file tree now display Git status badges.
  - Files display badges like `modif` (for modified), `baru` (for untracked/added), `rename` (for renamed), or `hapus` (for deleted), styled with transparent background colors and borders.
  - Folders display a right-aligned count of changed files inside the directory.
- **Auto Git Status Synchronization**:
  - Global `changedFiles` state managed at `App.tsx` and refreshed using a silent 5-second polling loop.
  - Immediate refetch when saving files in the Monaco Editor or manually refreshing Explorer/Changes panels.

## [1.3.43] - 2026-06-28

### Added
- **Per-Workspace Active Tab Memory**: Klik workspace di sidebar sekarang otomatis memindahkan fokus ke tab terakhir yang aktif di workspace tersebut. Jika tidak ada tab yang aktif, akan memilih tab pertama workspace, atau membuka shell baru di direktori workspace tersebut.
- **Tanda Checkmark pada Workspace Aktif**: Workspace yang tab-nya sedang aktif kini memiliki tanda checkmark (âœ“) dan style visual ungu yang mempertegas focus workspace saat ini.

### Improved
- **Responsive Workspace Actions**:
  - Pada layar mobile (`< 768px`): Tombol aksi workspace (delete, worktrees, git changes, browse files, terminal) disatukan ke dalam menu dropdown titik tiga (`â‹®`) yang responsif dan ringkas.
  - Pada layar tablet/desktop (`â‰¥ 768px`): Semua tombol aksi selalu ditampilkan secara langsung tanpa memerlukan efek hover.

## [1.3.41] - 2026-06-28

### Fixed
- **Terminal Blink/Flicker saat AI Agent Berjalan**: Eliminasi blinking yang terjadi ketika menjalankan AI coding agents (superagent, Claude Code, Antigravity CLI, dll) yang menghasilkan output streaming cepat (spinner, TUI redraws).
  - **Backend (`terminalManager.ts`)**: Tambah mekanisme **batch-flush 16ms** â€” data output PTY sekarang dikumpulkan dalam `pendingFlushChunks` lalu dikirim ke WebSocket sekaligus setiap 16ms (â‰ˆ 1 frame @60fps), menggantikan model lama yang mengirim setiap chunk PTY secara individual (ratusan WS messages/detik).
  - **Frontend (`TerminalInstance.tsx`)**: Tambah **RAF write-queue** â€” data WebSocket yang datang dikumpulkan dalam `writeQueueRef` lalu di-flush ke `term.write()` dalam satu `requestAnimationFrame`, memastikan xterm.js hanya repaint sekali per frame, bukan setiap kali data WS tiba.
  - Cleanup `cancelAnimationFrame` ditambahkan pada unmount untuk mencegah write ke terminal yang sudah di-dispose.

## [1.3.40] - 2026-06-28

### Improved
- **Terminal Refresh Normalize Trick**: Ubah logic refresh terminal dari simple `reset + init` menjadi **shrink â†’ restore** sequence. Saat tombol refresh diklik, PTY backend menerima resize kecil (setengah ukuran asli) terlebih dahulu, lalu setelah 120ms dikembalikan ke ukuran asli. Ini memaksa PTY mengirim dua sinyal SIGWINCH sehingga aplikasi TUI yang berjalan di alternate screen buffer (seperti Claude Code, Antigravity CLI, dll) melakukan **full redraw** dengan posisi yang benar, bukan sekadar resize visual saja.

## [1.3.39] - 2026-06-28

### Fixed
- **Tab real process name display**: Tab now shows the live active process name (e.g., `node`, `python`, `git`) instead of the static initial name. When the shell returns to idle (process name matches shellType), the tab name reverts to the original workspace-based name. Uses `focusedInst.name` from `terminalInstances` instead of static `t.name` in `App.tsx` tab rendering.
- **initialName tracking**: Added optional `initialName` field to `TerminalInstanceData` to preserve the original tab name across process title overrides.

## [1.3.38] - 2026-06-28

### Fixed
- **Mobile Side Menu z-index overlap**: Increased z-index of mobile sidebar, right sidebar (`z-index: 90`), and sidebar overlay (`z-index: 80`) in `layout.css` to sit cleanly above terminal split pane floating control bars (`z-index: 50`) on mobile screens.

## [1.3.37] - 2026-06-28

### Removed
- **Drag-and-Drop Tab Features**: Completely disabled HTML5 drag-and-drop actions on tabs (both tab reordering and drag-and-drop splitting), removing all overlay layers, drag states, refs, and unused local bindings to simplify layout orchestration and align with built-in button split options.

## [1.3.36] - 2026-06-28

### Removed
- **Terminal Pane Borders**: Removed the 1px purple/transparent border around terminal pane containers in `SplitLayoutRenderer.tsx` to provide a completely clean borderless terminal screen.

## [1.3.35] - 2026-06-28

### Added
- **Icon-Only Collapsed Sidebar**: Refactored the collapsed sidebar behavior to transition into a 48px vertical icon-only Activity Bar instead of hiding completely. Clicking any collapsed icon switches the active tab view and automatically expands the sidebar panel. Active tabs in collapsed mode feature a left purple indicator bar.

## [1.3.34] - 2026-06-28

### Changed
- **Seamless Tab-Terminal Theme Merge**: Changed `.top-bar` background to `#0b0f19` and removed `border-bottom` in `layout.css` to allow the top bar/tab area to blend seamlessly into the terminal view as a single cohesive dark slate surface.

## [1.3.33] - 2026-06-28

### Fixed
- **Multi-Stage Fit to Prevent Overflow**: Updated `debouncedFit` in `TerminalInstance.tsx` to run instantly and at sequential delays (50ms, 150ms, 300ms, 500ms) to cleanly capture window state maximization, split-pane resizes, and sidebar transitions.
- **Hidden Overflow on Pane Wrapper**: Added `overflow: 'hidden'` to the terminal leaf wrapper `div` in `SplitLayoutRenderer.tsx` to prevent the xterm canvas scrollbar or canvas viewport from overflowing the pane.

## [1.3.32] - 2026-06-28

### Changed
- **Zero-Padding Content Viewport**: Changed desktop `.content-area-tabs` wrapper padding from 16px to 0 in `layout.css` to allow the terminal to fully stretch to the left and right edges of the window layout.
- **Matched Background Colors**: Set `.terminal-container` background color to `#0b0f19` in `components.css` to perfectly align with xterm's slate background color, ensuring any leftover grid column spacing is visually hidden.

## [1.3.31] - 2026-06-28

### Changed
- **Edge-to-Edge Terminal Layout (No padding/borders)**: Removed the padding, rounding, shadows, and borders from `.terminal-container` and `.terminal-element` in `components.css`. The terminal canvas now sits completely flush and edge-to-edge (nempel ke kanan dan kiri) in its parent pane for a maximized, premium view.

## [1.3.30] - 2026-06-28

### Added
- **Tab Reordering (Drag and Drop)**: Integrated HTML5 drag-and-drop support on tab headers in `App.tsx`, enabling users to click, grab, and reorder tabs left/right seamlessly (just like Chrome browser tabs).
- **Automated Startup Session Restoration**: Replaced the manual background active session import banner/prompt with a fully automated restoration sequence. Active sessions are automatically queried and imported silently into UI tabs upon startup or authentication, ensuring a seamless user experience.

## [1.3.29] - 2026-06-28

### Fixed
- **Non-Destructive Terminal Refresh**: Refactored the terminal refresh button handler in `App.tsx` and `useTerminals.ts` to be non-destructive. Clicking the button now calls `term.reset()` to clear the frontend canvas visually and triggers a websocket `init` re-attach. This forces the backend to replay its session history buffer rather than killing the active shell process, preserving all background processes and build tasks.

## [1.3.28] - 2026-06-28

### Added
- **Terminal Context Menu (Copy/Paste/Select All/Clear)**: Added a premium custom HTML right-click context menu in the terminal panel, allowing users to Copy selected text, Paste clipboard data, Select All terminal text, and Clear the terminal screen. Selection state detection is managed dynamically.
- **Active PTY Sessions inside System Tray**: Added a dynamic listing of active terminal PTY sessions grouped by their workspaces inside the Electron system tray context menu. It polls running terminal sessions and workspaces periodically and updates context menu submenus smoothly when state changes occur.

## [1.3.27] - 2026-06-28

### Added
- **Refresh Terminal Button in Footer**: Added a Refresh/Restart Terminal button to the footer's layout control pill. When clicked, it terminates the active terminal session process on the backend and initiates a fresh terminal shell in the same workspace directory without closing/reopening the tab manually.

## [1.3.26] - 2026-06-28

### Added
- **Restart Desktop option in System Tray**: Added a new "Restart Desktop" menu item to the system tray context menu. This lets users relaunch the Electron wrapper shell cleanly via `app.relaunch()` and `app.quit()`.

## [1.3.25] - 2026-06-28

### Added
- **Auto-Close Tabs on Workspace Removal**: Updated `handleRemoveWorkspace` in `App.tsx` to automatically close all active terminal and file tabs that belong to the workspace being removed. This performs websocket unsubscriptions, deletes terminal instances from state, and safely updates the active tab focus.

## [1.3.24] - 2026-06-28

### Fixed
- **System Tray Backend Detection**: Enhanced the backend detection mechanism in `desktop/main.js` by checking `localhost` first, and falling back to `127.0.0.1` on error or timeout. This resolves connection check failures on systems where the loopback interfaces resolve to different IP families (IPv4 vs IPv6).
- **Real-Time Status Polling**: Implemented a periodic 5-second polling interval in the Electron main process to check the backend's status. The system tray will now dynamically update its status and enable/disable menu items in real-time, even if the backend process is started or stopped manually outside of Electron.

## [1.3.23] - 2026-06-28

### Added
- **Password Visibility Toggles**: Added eye/eye-off toggle buttons next to all master password inputs across the application (login, setup form, and master password change tabs in settings). This allows users to inspect or hide their entered password text for better accuracy.

## [1.3.22] - 2026-06-28

### Changed
- **Header Shortcut Icon**: Changed the keyboard shortcuts button icon in the top header from `Keyboard` to `HelpCircle`. This avoids confusion and visual collision on mobile screens where a second `Keyboard` icon toggles the virtual touch keyboard.

## [1.3.21] - 2026-06-28

### Added
- **Full Screen Mobile Login/Auth Screen**: Styled `.auth-wrapper` and `.auth-card` to match the full-screen layout on mobile (stretching edge-to-edge, zero margin, zero border-radius) while centering form content vertically for a premium user experience.

## [1.3.20] - 2026-06-28

### Added
- **Full Screen Mobile Modals**: Styled dialog modals (`.modal-overlay` and `.modal-content`) to take up the full width and height of the screen (edge-to-edge, zero margin, zero border-radius) on mobile devices to optimize display space and styling.

## [1.3.19] - 2026-06-28

### Fixed
- **CSS Reset Specificity**: Wrapped the universal CSS reset (`* { margin: 0; padding: 0; }`) and default element styles (`body`, `button`, `input`, `a`, etc.) inside Tailwind CSS's `@layer base` block. This prevents unlayered CSS resets from overriding layered Tailwind utility classes (like `.px-4` or `.md:px-4`) under standard CSS Cascade Layer rules.
- **index.css Modularization**: Refactored the large, 1,311-line `index.css` file by splitting it into modular, smaller stylesheets (`base.css`, `layout.css`, `components.css`) to adhere to the project's strict 1,000-line file length limit.

## [1.3.18] - 2026-06-28

### Fixed
- **Modal Overlay App-Region Interaction**: Added `-webkit-app-region: no-drag` to `.modal-overlay` and `.modal-content` in CSS. This resolves an issue in Electron frameless windows where clicks on the modal (which sits on top of draggable title/topbar zones) were intercepted as window drag events by the OS, preventing input fields (like the master password fields in settings) from receiving focus and keyboard input.

## [1.3.17] - 2026-06-28

### Fixed
- **Footer Horizontal Padding Adjustment**: Increased horizontal padding on the left and right sides of the footer (`Footer.tsx`) from `px-4` (16px) to `px-6` (24px) to give elements more breathing room and prevent a cramped layout near the screen boundaries.

## [1.3.16] - 2026-06-28

### Added
- **Modern Footer Redesign**: Reorganized the footer status bar (`Footer.tsx`) with a premium, space-efficient, and responsive layout:
  - Added new visual icons for Workspace (`Folder`) and Network (`Globe`) to align with design standards.
  - Implemented glassmorphism styling (`backdrop-blur-md bg-[#080b13]/90 border-t border-white/10 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]`).
  - Added micro-interaction animations such as hover scaling on zoom controls and translation animations on action buttons.
  - Re-styled the default HTML select element with a custom background, borders, and a custom SVG chevron icon indicator to match other premium elements.
  - Formatted active Cloudflare Tunnel statuses into unified badges with subtle glowing dropshadows.
  - Integrated mobile-responsive styles to automatically hide labels/text descriptions and collapse elements, avoiding vertical overlaps on small screen widths.

## [1.3.15] - 2026-06-28

### Fixed
- **Mobile Terminal Action Bar Relocation**: Relocated the floating terminal action bar inside `SplitLayoutRenderer.tsx` from the top-right corner (`top-2 right-2`) to the bottom-right corner (`bottom-2 right-2 top-auto`) on mobile and tablet viewport sizes. The top-right positioning is preserved (`lg:top-2 lg:right-2 lg:bottom-auto`) on desktop screens. This prevents buttons from overlapping the terminal output area or other header elements on small devices.

## [1.3.14] - 2026-06-28

### Added
- **Cloudflare Quick Tunnel Propagation Tip**: Added a helpful info tooltip (`Info` icon from `lucide-react`) next to the generated tunnel URL in `Footer.tsx` when a Cloudflare Quick Tunnel is launched. This informs users that dynamic subdomains (like `*.trycloudflare.com`) can take 5-15 seconds for DNS records to propagate, guiding them to wait and reload if they encounter a "This site can't be reached (NXDOMAIN)" error.

## [1.3.13] - 2026-06-28

### Added
- **Cloudflare Tunnel Start/Stop Loading Feedbacks**: Added a reactive `tunnelLoading` state inside the `useTunnel` hook. The Cloudflare Tunnel status badge in `Footer.tsx` now shows a blue spinning loader and displays `Starting...` or `Stopping...` while operations are in progress. Disabled all tunnel control buttons (Quick URL, Custom, Stop) during loading to prevent race conditions. Also integrated the loading feedback with a rotating spinner inside the submit button and disabled forms inside `TunnelSetupModal` (`Modals.tsx`).

## [1.3.12] - 2026-06-28

### Added
- **Responsive Terminal Split Actions**: Modified the floating action bar in `SplitLayoutRenderer.tsx` to be always visible on mobile and tablet screen sizes (`opacity-100 lg:opacity-0 lg:group-hover/pane:opacity-100`) because hover events do not exist on touch devices. Enlarged the touch target size of the action buttons from `20px` to `28px` (`w-7 h-7 lg:w-5 lg:h-5`) and increased icon sizes on mobile and tablet viewports to make them touch-friendly. Added `onTouchEnd` event stop propagation to prevent touch event leaks.

## [1.3.11] - 2026-06-28

### Fixed
- **Terminal Resize / Fit Debouncing**: Debounced terminal fit actions inside `TerminalInstance.tsx` using a callback helper. This prevents multiple overlapping `fit()` calls from executing simultaneously during initial page render, font size changes, and layout transitions (such as sidebar animation or virtual keyboard popping up). Redundant fits are now coalesced into a single sizing request, eliminating terminal content flashing ("blink-blink") and reducing PTY resize network traffic.

## [1.3.10] - 2026-06-28

### Fixed
- **Mobile Terminal Click Focus & Virtual Keyboard**: Added capturing phase event listeners for click and touch events on the terminal container inside `TerminalInstance.tsx` to bypass `xterm.js`'s event propagation blocking (`stopPropagation`). Also wrapped the terminal instance's focus callback inside `SplitLayoutRenderer.tsx` to ensure `focusTerminal` is always invoked when the user taps on a terminal pane on mobile, reliably toggling the virtual touch keyboard.

## [1.3.9] - 2026-06-28

### Added
- **Tunnel URL Copy Action**: Added a "Copy" button next to the "Open" button in the footer when a Cloudflare Tunnel is active. This allows the user to copy the active tunnel URL to their clipboard with a temporary success indicator state showing a green checkmark and "Copied".

## [1.3.8] - 2026-06-28

### Fixed
- **node-pty AttachConsole Crash**: Added a try-catch block to `node-pty`'s internal console process list agent and monkeypatched `node-pty`'s `WindowsPtyAgent` constructor in `terminalManager.ts` to run the console process list fork silently on Windows. This suppresses distracting and noisy uncaught `AttachConsole failed` stack traces in the backend log console during terminal process cleanup.

## [1.3.7] - 2026-06-28

### Fixed
- **Mobile Top-Bar & Icon Alignments**: Increased size of Keyboard and MoreVertical toggle icons to `18px` in mobile view to align with other icons. Adjusted top-bar margins and padding to `12px`, and increased action buttons' touch target paddings to `6px`.
- **Right Drawer Touch Enhancements**: Adjusted padding on mobile "New Tab" button in RightSidebar.

## [1.3.6] - 2026-06-28

### Fixed
- **Custom Keyboard Padding**: Increased the bottom padding of the virtual touch keyboard on mobile devices to `24px` to prevent overlapping with native gesture bars and home indicator areas.

## [1.3.5] - 2026-06-28

### Added
- **Mobile Right Drawer Menu**: Relocated active tabs, settings, and logout options on mobile screens to a dedicated right side slide-out drawer menu.
- **Top-Bar Menu Toggle Button**: Added a new menu action button (vertical dots icon) in the top-right of the navigation bar on mobile screens to open the right drawer.
- **Top-Bar Cleanup**: Hid settings and logout buttons from the top bar on mobile, moving them cleanly to the new right menu drawer.

## [1.3.4] - 2026-06-28

### Fixed
- **Welcome Dashboard Spacing**: Increased the vertical margins (`mb-`) of elements (icon wrapper, title, and description text) on the empty dashboard view to add more breathing room and prevent texts from sticking too close together.

## [1.3.3] - 2026-06-28

### Fixed
- **Welcome Dashboard Bottom Padding**: Replaced Tailwind inline card padding configuration with custom `.welcome-card-outer` and `.welcome-card-inner` classes, enforcing explicit paddings (40px on desktop and 24px on mobile) using `!important` to resolve the button padding cutoff.

## [1.3.2] - 2026-06-28

### Added
- **Responsive & Minimalist Terminal Spacing**: Refactored the terminal content area classes and container padding. Added mobile-first overrides that remove boundaries, borders, and paddings for a highly minimalist experience on small screens while keeping terminal layouts edge-to-edge.
- **Desktop Padding Area**: Added a beautiful 16px desktop padding area around the terminal container to restore the premium rounded-border look when tabs/terminals are active on desktop.
- **Responsive Welcome Dashboard**: Optimized `EmptyDashboard` layout with responsive paddings, margins, button sizes, and icon scaling to ensure a compact, minimalist experience on mobile.

## [1.3.1] - 2026-06-27

### Fixed
- **Monaco Full-Width Stretch**: Updated `FileViewerTab.tsx` parent container class names with `flex-1 w-full h-full` and passed `width="100%"` explicitly to the Monaco `<Editor>` component, ensuring the coding area stretches cleanly to fill the entire horizontal space of the right viewport pane.

## [1.3.0] - 2026-06-27

### Added
- **Debounced Auto-Save**: Integrated a 1000ms debounced auto-save mechanism inside `FileViewerTab.tsx`. Edits are automatically saved to disk when the user pauses typing.
- **Auto-Save Status Bar**: Created real-time feedback elements in the header (e.g. `Saving...`, `Saved` checkmark, `Modified`, or `Auto-save active`) to indicate write status dynamically.

## [1.2.9] - 2026-06-27

### Added
- **Monaco Code Editor Integration**: Replaced the text area with a full Monaco Editor (`@monaco-editor/react`) for code editing. Features full syntax highlighting, automatic language selection from file extensions, smooth caret animations, and a customized `#030408` theme background.
- **Default Editable Mode**: Enabled file editing by default upon opening any file. Added visual `Modified` state flags, real-time dirty state tracking, and a Save / Revert action bar in the header.

## [1.2.8] - 2026-06-27

### Fixed
- **Sidebar Auto-Collapse on File Open**: Updated `openFileTab` inside `useTerminals.ts` to trigger the `onTerminalOpen` callback. This automatically closes/collapses the left sidebar panel on mobile and tablet devices when a file is opened, immediately showing the File Viewer/Editor interface.

## [1.2.7] - 2026-06-27

### Added
- **Pulsing Skeleton Loader**: Replaced the reading spinner in `FileViewerTab.tsx` with a highly-polished layout-aligned skeleton loader that simulates header bars and rows of code text when loading a file.

## [1.2.6] - 2026-06-27

### Added
- **File Explorer Editor Support**: Integrated an editor mode inside `FileViewerTab.tsx` with a toggled textarea, enabling full-featured file edits. Exposed a new POST `/api/fs/write` route in `server.ts` to write updated files back to disk.

## [1.2.5] - 2026-06-27

### Added
- **Hide Keyboard Button**: Added a dedicated `âœ•` button to the far right of the mobile virtual keyboard's modifier toolbar. Clicking this button hides the touch virtual keyboard directly from the interface.

## [1.2.4] - 2026-06-27

### Fixed
- **Mobile & Tablet Responsive Buttons**: Made the active sessions alert banner container use `flex-col md:flex-row` and added `whitespace-nowrap` to the action buttons to prevent text wrapping on narrow screen sizes. Also updated the welcome dashboard buttons container (`EmptyDashboard.tsx`) to use `flex-col sm:flex-row` to stack cleanly on mobile screen sizes.

## [1.2.3] - 2026-06-27

### Added
- **Mobile Sidebar Active Tabs Menu**: Added a new mobile-only sidebar panel tab called `Tabs` that lists all currently active pseudoterminal tabs. Clicking any tab in this menu activates it and collapses the sidebar.
- **Auto-Responsive Text Size**: Locked the default terminal font size to `8px` on mobile/tablet viewports (screen width <= 768px) to reduce line-wrapping and improve code readability, while keeping the user's preferred zoom size on desktop.

### Fixed
- **App.tsx Refactoring**: Moved the sidebar panel content rendering blocks into a separate component `SidebarContentPanel.tsx` to keep the code modular and under the 1000-line limit (reduced `App.tsx` from 1060 lines down to 903 lines).

## [1.2.2] - 2026-06-27

### Added
- **Auto-Suppress Native Keyboard & Auto-Open Custom Keyboard**: Dynamically set `inputmode="none"` on the hidden helper `<textarea>` of xterm.js to suppress the native mobile virtual keyboard. Integrated an `onTerminalFocus` callback so that clicking/tapping on any terminal instance automatically opens the custom virtual touch keyboard on mobile.

## [1.2.1] - 2026-06-27

### Fixed
- **Mobile Navigation Overlap**: Added `calc(env(safe-area-inset-bottom, 0px) + 16px)` bottom padding to the virtual keyboard to prevent the Enter and Space keys from being covered by browser bottom bars or Android system navigation indicators.
- **Minimalistic Mobile Header**: Reduced `--topbar-height` from 56px to 42px on mobile viewports. Hid the desktop-specific `Keyboard Shortcuts` button from the Topbar when accessed from mobile devices.
- **Sleeker Virtual Keyboard Key Sizes**: Reduced QWERTY keys font size to `text-[12px]` and vertical padding to `py-2.5`, making the layout much more compact and professional.

## [1.2.0] - 2026-06-27

### Added
- **Custom Touch On-Screen Keyboard**: Integrated a premium, toggleable virtual on-screen keyboard (`MobileKeyboard`) visible on mobile screens (< 768px). Includes sticky modifier locks for `Ctrl` and `Alt` (enabling shortcuts like `Ctrl+C` or `Ctrl+D` on touch), standard QWERTY rows, a symbols toggle tab, and arrow navigation pads (`â†‘`, `â†“`, `â†�`, `â†’`).

### Fixed
- **App.tsx Code Complexity Reduction**: Refactored `startResizing` and `handleMergeTab` drag/merge logic from `App.tsx` into a custom hook `useLayoutHelpers.ts` to keep the core component under the strict 1000-line ceiling.

## [1.1.9] - 2026-06-27

### Fixed
- **Mobile Touch Input Focus (Android/iOS)**: Added explicit click and touch listeners (`onClick` and `onTouchEnd`) on the pseudo-terminal container to directly trigger `.focus()` on xterm.js's hidden helper textarea inside a user interaction gesture, allowing virtual keyboards on Android and iOS to open reliably when tapping a terminal tab.

## [1.1.8] - 2026-06-27

### Added
- **Active Session Import Offer on Web Access**: Added a notification banner and session importer to let web browser dashboard instances discover and load active pseudo-terminal sessions currently running in the backend (e.g. from the desktop app).
- **Active Terminal Listing Endpoint**: Exposed `/api/terminals/active` on the backend to list running terminal PTY sessions with their details.

## [1.1.7] - 2026-06-27

### Added
- **HTTP Health Verification on Port Collision**: Replaced net socket connection checks in desktop initialization with an HTTP-based health check probing the t-line setup API, avoiding false positives on unrelated services using port 3999.
- **Sequential Git Status Processing**: Implemented sequential worktree status checking to prevent peak CPU and disk I/O bottlenecks in getWorkspaceInfo.

### Fixed
- **Strict 1000-Line Limit Refactoring**: Refactored frontend `App.tsx` from 1364 lines down to 998 lines by extracting `SplitLayoutRenderer`, `WorkspaceList`, and `EmptyDashboard` into separate files.
- **Git Command Injection Vulnerability**: Replaced shell-interpolated child_process `exec` execution in gitManager with parameter-safe `execFile` array argument passing and added a 15-second timeout on all git executions to prevent zombie processes.
- **Secure Bypass Token File Permissions**: Added restricted owner-only file permissions (`mode: 0o600`) when writing the bypass token file.
- **Memory-Efficient Terminal Buffer**: Refactored terminal output buffers in terminalManager to use chunked array of strings instead of continuous string allocation/slicing on every PTY write.

## [1.1.6] - 2026-06-27

### Fixed
- **Terminal Mouse Reporting Support**: Changed the pseudo-terminal spawn options on Windows to use the modern `ConPTY` engine (`useConpty: true`) instead of legacy `winpty`. This enables standard ANSI mouse event reporting (like SGR click and scroll tracking), allowing interactive TUI applications (e.g. `superagent`) running inside `t-line` tabs to natively receive and process mouse clicks.

## [1.1.5] - 2026-06-27

### Added
- **Tiled & Grid Split Terminal Layout**: Rebuilt the split terminal feature to support independent grid/tiled layouts per tab using nested `react-resizable-panels`. Multiple terminal sessions can be split horizontally or vertically in any nested configuration inside a single tab.
- **Floating Action Bar**: Integrated a floating, hover-activated action bar in each terminal pane with buttons to split horizontally/vertically or close individual panes.
- **Drag and Drop Merge Splitting**: Dragging any terminal tab and dropping it onto a split zone (left, right, top, bottom) of another tab merges its terminal session into that tab's split layout.
- **Dynamic Title Synchronization**: Updated active tab titles to dynamically reflect the name of the currently focused terminal pane.

## [1.1.4] - 2026-06-27

### Changed
- **Split Pane Library**: Replaced custom split ratios and drag-resize calculations with the `react-resizable-panels` library for horizontal and vertical splitting.
- **Terminal Resize Observer**: Added a `ResizeObserver` on `TerminalInstance` to automatically refit the active terminal container when dragging split panel layout sizes or collapsing/expanding the sidebar, providing smooth and native-feeling window sizing.

## [1.1.3] - 2026-06-27

### Added
- **Keyboard Shortcuts** (`useKeyboardShortcuts` hook): Ctrl+T buka terminal baru, Ctrl+W tutup tab aktif, Ctrl+Tab/Ctrl+Shift+Tab navigasi tab, Ctrl+1-9 loncat ke tab ke-N, Ctrl+Shift+D/E toggle split pane horizontal/vertikal, Ctrl+=/- zoom in/out.
- **Split Pane Terminal** (`useSplitPane` hook): tampilkan dua terminal secara horizontal (side-by-side) atau vertikal (atas-bawah) dengan resize handle bisa di-drag. Tombol split muncul otomatis di tab bar jika ada â‰¥2 terminal.
- **Terminal Search Bar**: Ctrl+Shift+F membuka search bar floating di atas terminal (SearchAddon). Fitur: prev/next result, toggle case-sensitive, toggle regex, close (Esc).
- **Unicode11Addon**: dukungan penuh karakter emoji, CJK, dan unicode lebar lainnya di terminal.
- **Output Buffer Replay**: saat WebSocket reconnect, backend mengirim ulang output terminal yang terlewat selama koneksi terputus (buffer 128KB rolling).

### Changed
- **Session Cleanup Timeout**: PTY session detach timeout dari 60 detik â†’ 30 detik.
- **Terminal Auto-Focus**: terminal aktif otomatis mendapat focus saat tab di-switch.
- **Tab Bar**: tombol `+` New Terminal sekarang muncul dengan tooltip `(Ctrl+T)`. Tombol split Columns/Rows muncul hanya saat ada â‰¥2 terminal aktif.

## [1.1.2] - 2026-06-27

### Added
- **WebLinksAddon**: URL/link yang muncul di terminal sekarang bisa diklik langsung (Ctrl+Click/Click) menggunakan `xterm-addon-web-links@^0.9.0`.
- **Enhanced Scroll Behavior**: Scrollback buffer ditingkatkan ke 10.000 baris (sebelumnya default), `scrollOnUserInput: true` agar terminal otomatis scroll ke bawah saat mengetik, Shift+Scroll untuk fast scroll.
- **Selection Highlight**: Warna selection teks di terminal kini ungu semi-transparan (konsisten dengan tema app) termasuk state inactive selection.
- **Right-Click Select Word**: Klik kanan pada kata langsung men-select kata tersebut untuk kemudahan copy.
- **Font Refinement**: Ditambahkan `Fira Code` sebagai fallback font, `lineHeight: 1.2` untuk keterbacaan yang lebih baik.

## [1.1.1] - 2026-06-27

### Changed
- **Workspace List Full Bleed**: Removed horizontal padding on the workspace list container so cards stretch edge-to-edge (flush kanan kiri) inside the sidebar. Cards now use a bottom border separator instead of individual rounded borders, matching the visual style of Explorer and Changes panels.

## [1.1.0] - 2026-06-27

### Removed
- **Global Shell Concept**: Removed the 'Global Shell' terminal title and button configurations, routing all terminal instances through active workspace scopes under standard 'Shell' naming.

## [1.0.9] - 2026-06-27

### Added
- **Backend Process Name Polling**: Integrated active foreground process tracking on the backend (querying `node-pty` process names every 1,000ms) and dispatching WebSocket `title` events to update client terminal tab titles dynamically, resolving WinPTY/shell limitations on Windows.

## [1.0.8] - 2026-06-27

### Changed
- **Full Bleed Sidebar Panels**: Configured the File Explorer and Git Changes sidebar panels to be full bleed (flush/nempel) to the left, right, and top edges by conditionally removing the sidebar-content padding and gaps.

## [1.0.7] - 2026-06-27

### Added
- **Dynamic Terminal Tab Titles**: Integrated xterm's `onTitleChange` event handler on the frontend to dynamically update tab titles to match the actual shell process or active directory title.
- **Terminal State Hook Extraction**: Refactored all terminal-related React states, LocalStorage sync handlers, zoom functions, and open/close commands out of `App.tsx` into a modular custom hook `useTerminals.ts`. This reduces the complexity of `App.tsx` to 966 lines, keeping it below the strict 1,000-line limit.

## [1.0.6] - 2026-06-27

### Added
- **File Tab Opening**: Clicking a file in the File Explorer now opens it as a dedicated tab in the main editor area alongside terminal tabs, complete with line numbering, custom dark styling, and a Copy button.
- **Workspace Terminal Paths**: Configured new terminals (from the `+` button or the welcome screen) to open automatically in the current active workspace directory rather than the user's home directory.
- **Default Maximize Window**: Programmed the desktop application window to launch maximized by default.
- **Bottom Status Bar (Footer)**: Relocated the Cloudflare Tunnel widget, status indicator, and controls from the sidebar to a new bottom status bar (footer) to free up sidebar space and match standard workspace design layouts.
- **Dynamic Maximize/Restore Icons**: Integrated main process maximize/unmaximize listeners and window state checks to dynamically toggle the window header maximize button between standard maximize (`â–¢`) and restore (`â��`) icons.
- **Terminal Font Size & Zoom Controls**: Decreased default terminal font size to `12px` and added real-time Zoom In and Zoom Out controls inside the terminal tab bar header with persistent storage.
- **Minimalist Headers**: Streamlined the sidebar logo area (removing card backgrounds, padding, and version badges) and the main top bar connection status display (removing connection status labels, leaving a single status dot with hover details) to create a clean, distraction-free environment.
- **Merged Tab Bar**: Integrated the terminal/file tab bar, font zoom controls, and default shell selector directly into the top window bar header (top-bar) to save vertical screen space and align standard workspace layout design.
- **Full Bleed Terminal View**: Removed container padding, borders, and margins from the active panel area when tabs are open, making the terminal and file viewer panes attach fully (flush/nempel) to all edges.
- **Git Branch Status in Footer**: Embedded the active Git branch name (e.g. `main`, worktrees, or `detached`) directly next to the active workspace path in the bottom status bar, with uncommitted change warnings (yellow pulsing dot) and distinct worktree/main branch coloring.
- **Terminal Zoom & Shell Selector Relocated to Footer**: Shifted the terminal zoom buttons and default shell selector dropdown out of the top window header and embedded them inside a center-aligned dashboard pill in the status bar footer, maximizing header space and layout clarity.
- **Vertical Header Dividers**: Added left and right vertical dividers flanking the integrated tab bar container inside the top window header to cleanly isolate active workspaces from connection status details and system actions.
- **Streamlined Header Spacings**: Restructured the spacing inside the top window bar header (increasing gaps to `16px` for info/actions, adding margins to individual tabs, separating zoom controls, shell selectors, and window buttons) to prevent item clumping and ensure a professional, polished layout.
- **Tunnel Access Control & Device Management**: Integrated an IP rule manager and request logger. Created an 'Access Control' settings interface displaying active device types, IP addresses, and activity timestamps, enabling users to instantly block/unblock client IPs and restrict WebSocket terminal upgrades with a self-blocking fail-safe.

## [1.0.5] - 2026-06-27

### Added
- **Settings Modal**: Added a settings button next to logout that displays system version/details and supports updating the master password.
- **Resizable Panels**: Added a draggable divider handle between the left sidebar and right content panel (allowing customization of the sidebar width, stored in `localStorage`).
- **Sidebar Collapse/Minimize**: Upgraded the sidebar toggle to work on desktop (minimizing sidebar to width `0`) as well as mobile devices.
- **Frameless Header Integration**: Removed the dedicated custom title bar to maximize vertical space. Integrated minimize, maximize, and close buttons on the right side of the main `top-bar` (only visible in Electron), and configured drag regions on headers to support native window dragging.

### Changed
- **Architectural Hook Extraction**: Extracted `useTunnel` and `useWorkspaces` custom hooks from `App.tsx` to new files in `frontend/src/hooks/`. This modularized network fetching, reduced code duplication, and brought `App.tsx` down to 866 lines (conforming to the repository's 1000-line limit).

## [1.0.4] - 2026-06-27

### Added
- **Skip Backend Spawn if Already Running**: Added a TCP port check on port `3999`. If the backend is already running, the desktop wrapper skips spawning a new backend process and connects to it directly.
- **Shared Ephemeral Bypass Token**: The backend now writes its ephemeral bypass token to `~/.tline-bypass-token` on startup and deletes it on exit, letting the desktop wrapper automatically authenticate with the externally running backend.

## [1.0.3] - 2026-06-27

### Added
- **Workspace Navigation UX**: Added a dropdown workspace selector at the top of both the **Explorer** and **Changes** sidebar panels. This allows users to view and switch workspaces directly from these panels.
- **Auto-Select Active Workspace**: Added automatic selection logic. If only one workspace is tracked, it is automatically selected. Switching to **Explorer** or **Changes** tabs auto-selects the first available or first Git-enabled workspace if none was selected, preventing empty/unselected panel states.

## [1.0.2] - 2026-06-27

### Added
- **System Tray Integration**: Added system tray icon and background running capability. The main window now hides to the system tray on close instead of exiting completely, and alerts the user with a cross-platform system notification on the first hide.
- **Backend Process Controls**: Added Start, Stop, and Restart controls for the backend process directly inside the system tray context menu. Included a fallback state page in the main window when the backend is stopped.
- **Premium App Icon**: Added a sleek, high-resolution Obsidian-themed application icon used for both the window icon and the system tray.

### Changed
- **Dependencies Configuration**: Moved the `electron` package from `dependencies` to `devDependencies` in `desktop/package.json` and pinned it to a fixed version as required by `electron-builder`.

## [1.0.1] - 2026-06-27

### Fixed
* **PTY Terminal Directory Cwd Separators**: Normalized the `cwd` directory path on the backend before spawning shells in `terminalManager.ts`. This resolves directory alignment issues on Windows where path separators or slashes could fail to set the terminal folder to the tracked workspace or worktree path.

## [1.0.0] - 2026-06-27

### Added
* **Premium Obsidian Dark Theme**: Implemented a rich dark theme (`#05070c`) featuring glassmorphic panels, mesh lighting accents, subtle radial grid background, hover animations, and pulsing git status indicators.
* **Tailwind CSS v4 Integration**: Added Vite native Tailwind v4 support in the frontend project workspace.
* **Active Tab & Terminal Persistence**: 
  * Terminal tab state, active tab ID, directories (`cwd`), and shell types are saved in `localStorage` in real-time.
  * Backend auto-spawns PTY shells on startup or hot-reloads running sessions gracefully upon browser refresh.
  * System clears local tab settings automatically on logout.
* **Custom Frameless Title Bar**: Configured Electron wrapper with `frame: false` and created a custom title bar in React featuring native Minimize, Maximize, and Close commands via IPC Context Bridge.
* **Local Web Directory Browser**: Implemented fallback folder navigation service endpoint (`/api/fs/list`) enabling web client users to browse drives and host folder structures when native file dialogs are inaccessible.
* **Reusable Form UI Components**: Created modular, styled components (`Input`, `Select`, `TextArea`, `FormField`, `Button`) in `Form.tsx` to handle inputs and dynamic button states with consistent aesthetics.
* **Standalone Executable Compilation**: Configured `electron-builder` in the desktop wrapper and added root script `npm run build:exe` to package the entire workspace stack into a standalone `.exe` installer.

### Changed
* **Architectural Decoupling**: Refactored the core frontend structure, extracting `TerminalInstance`, `AuthForms`, `Modals`, and `websocket` network manager to separate files. This reduced `App.tsx` from 1333 lines down to a clean 880 lines (strictly complying with the 1000-line code limit).

### Security
* **Authentication Bypass**: Implemented local runtime ephemeral tokens to automatically authenticate local Electron clients while enforcing strict Master Password locks on incoming web requests.


