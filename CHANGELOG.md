# Changelog

All notable changes to the **t-line** workspace manager project will be documented in this file.

---

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
- **Hide Keyboard Button**: Added a dedicated `✕` button to the far right of the mobile virtual keyboard's modifier toolbar. Clicking this button hides the touch virtual keyboard directly from the interface.

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
- **Custom Touch On-Screen Keyboard**: Integrated a premium, toggleable virtual on-screen keyboard (`MobileKeyboard`) visible on mobile screens (< 768px). Includes sticky modifier locks for `Ctrl` and `Alt` (enabling shortcuts like `Ctrl+C` or `Ctrl+D` on touch), standard QWERTY rows, a symbols toggle tab, and arrow navigation pads (`↑`, `↓`, `←`, `→`).

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
- **Split Pane Terminal** (`useSplitPane` hook): tampilkan dua terminal secara horizontal (side-by-side) atau vertikal (atas-bawah) dengan resize handle bisa di-drag. Tombol split muncul otomatis di tab bar jika ada ≥2 terminal.
- **Terminal Search Bar**: Ctrl+Shift+F membuka search bar floating di atas terminal (SearchAddon). Fitur: prev/next result, toggle case-sensitive, toggle regex, close (Esc).
- **Unicode11Addon**: dukungan penuh karakter emoji, CJK, dan unicode lebar lainnya di terminal.
- **Output Buffer Replay**: saat WebSocket reconnect, backend mengirim ulang output terminal yang terlewat selama koneksi terputus (buffer 128KB rolling).

### Changed
- **Session Cleanup Timeout**: PTY session detach timeout dari 60 detik → 30 detik.
- **Terminal Auto-Focus**: terminal aktif otomatis mendapat focus saat tab di-switch.
- **Tab Bar**: tombol `+` New Terminal sekarang muncul dengan tooltip `(Ctrl+T)`. Tombol split Columns/Rows muncul hanya saat ada ≥2 terminal aktif.

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
- **Dynamic Maximize/Restore Icons**: Integrated main process maximize/unmaximize listeners and window state checks to dynamically toggle the window header maximize button between standard maximize (`▢`) and restore (`❐`) icons.
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
