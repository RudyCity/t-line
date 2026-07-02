# Changelog

All notable changes to the **t-line** workspace manager project will be documented in this file.

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


