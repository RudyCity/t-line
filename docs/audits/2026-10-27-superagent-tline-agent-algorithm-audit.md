# Audit algoritma SuperAgent pada T-Line — 2026-10-27

**Scope:** perilaku agent, bukan status runtime/port. Repositori: `t-line` + `superagent` (`main`).
**Status:** NOT VERIFIED END-TO-END; temuan berikut berdasarkan audit kode. Tidak ada source code yang diubah oleh audit ini.

## Arsitektur yang benar

- SuperAgent CLI dan T-Line memakai `Agent` yang sama (`superagent/src/core/agent.ts`) dengan klasifikasi permintaan, loop tools, compaction, memory, dan advisor yang sama.
- Jalur T-Line: composer -> WS desktop -> `superAgentBridge.ts` -> Core `/api/chat` -> durable turn worker -> `Agent.sendMessage` -> SSE Core -> WS desktop -> reducer UI.
- Mode multi memerlukan model tier master dan orkestrasi Core. Chat queue per session bukan otomatis beberapa autonomous background workers.
- Tujuan bukan menduplikasi algoritma di frontend. Perbaiki kontrak transport/state dan routing yang memengaruhi semantik Agent; Core tetap source of truth.

## Findings (verifikasi akhir memerlukan E2E nyata)

### ALG-01 [P0, code-confirmed conditional race] Init dan SSE tidak diserialkan

- T-Line `backend/src/superAgentBridge.ts:908-913` menjalankan `connectToSuperAgentSSE()` sebelum `initializeSuperAgentSession(...)`, tanpa `await`.
- Core `src/serverRoutes.ts:313-323` mengembalikan HTTP 404 bila `sessionId` belum terdaftar.
- T-Line `backend/src/superAgentBridge.ts:750-781` hanya menjadwalkan retry pada 503 atau 400 yang dikenali sebagai initializing, bukan 404; `init` berhasil tidak memanggil SSE kembali.
- UI `SuperAgentConsole.tsx:552-560,785-855` menganggap WS OPEN cukup untuk mengirim chat, bukan Core session READY. First prompt bisa memperoleh `Session not initialized`; bridge menolak replay otomatis (benar untuk unknown accepted writes).
- Perbaikan: typed readiness state `WS_CONNECTED -> INIT_ACK(session,workspace,mode) -> SSE_SUBSCRIBED -> READY`; GET/SSE 404 awal boleh di-retry hanya setelah init valid, bukan resend POST chat. Uji error-safe timeout dan session switching.
- Gate: 100 cold first sends + 100 reconnects dengan session baru, nol first-turn loss/false-ready; trace id terikat session.

### ALG-02 [P0, direct data-shape gap] Lampiran gambar bukan input vision terstruktur

- `frontend/src/components/SuperAgentConsole.tsx:807-825` mengubah file gambar menjadi string Data URL lalu menyambungkannya ke prompt teks.
- `SuperAgentConsole.tsx:850-855` hanya mengirim `text: finalPrompt`; `backend/src/superAgentBridge.ts:984,1015-1022` hanya meneruskan string.
- Core `/api/chat` dan `Agent.sendMessage` mendukung message content berbentuk multimodal (`src/serverRoutes.ts:1346-1369`, `src/core/agent.ts:607`). Jalur T-Line tidak memanfaatkannya.
- Dampak: gambar besar menghabiskan konteks tekstual / mungkin batas request; informasi visual tidak terjamin dipahami sebagai gambar.
- Perbaikan: typed content parts dengan image + MIME/size limits, server validation, model vision capability checks, secure attachment handling. Jangan menyimpan raw base64 dalam prompt/history UI.
- Gate: gambar relevan dijawab sama secara semantik via T-Line dan CLI, termasuk 2 gambar + teks, dan fallback eksplisit jika model tidak vision.

### ALG-03 [P1, code-confirmed] Satu global progress callback untuk banyak agent

- `superagent/src/core/agent.ts:314-317` memanggil `registerProgressCallback` pada setiap konstruktor Agent.
- `superagent/src/core/tools/state.ts:535-543` mengimplementasikan satu variabel `globalProgressCallback` yang selalu diganti.
- Dampak: progress tool yang melewati callback ini dapat sampai pada agent terakhir dibuat, bukan pemilik tool asli, khususnya banyak sesi dan subagent.
- Perbaikan: scoped progress subscriptions berdasarkan execution/session/agent ID; jangan gunakan satu callback mutabel global. Uji 2 sesi + 2 subagent interleaving.

### ALG-04 [P1, direct UI correctness bug] Subagent UI membuat ID palsu

- `t-line/frontend/src/components/SuperAgentConsoleUtils.ts:306-323` membuat `Math.random()` ID dan status `RUNNING` saat melihat `invoke_subagent` tool args.
- Core menyiarkan identitas sesungguhnya melalui `subagents_update` (`superagent/src/server.ts:565-590`); reducer lain menggabungkan berdasarkan ID.
- Akibat: entri spekulatif dapat tampil sebagai agen kedua/stuck `RUNNING` karena identitasnya tidak sama dengan Core.
- Perbaikan: status `requested` terpisah dari `spawned`; hanya `subagents_update` atau event Core bersession dan ber-ID asli yang boleh membuat agent row. Gunakan event id, parent id, dan lifecycle terminal.

### ALG-05 [P1, event recovery gap] Replay cursor salah sumber

- Core `/api/events` membaca replay cursor dari query `lastEventId` (`superagent/src/serverRoutes.ts:333-335`), dan menghasilkan `id: <Core event id>` dalam `server.ts:453-460`.
- T-Line mengirim `Last-Event-ID` header (`superAgentBridge.ts:733-749`) yang dibentuk dari `sseEventCounter` lokal; SSE parser `807-822` mengabaikan baris `id:` Core.
- Akibat: replay Core tidak terpakai untuk endpoint ini, dan cursor lokal tidak identik dengan ID Core. Buffer 200 event milik satu WS hanya pemulihan parsial.
- Perbaikan: baca SSE spec lengkap (id/data/batas frame), simpan cursor Core yang asli per session, kirim `?lastEventId=...`, deteksi gap/retention; idempotent reducer. Tidak boleh replay command/POST.

### ALG-06 [P1, observable status drift] Status durable turn tidak dirender sebagai outcome utama

- Core `src/core/utils/chatRuntimeProcessor.ts:54-69` membedakan completed/failed/interrupted/cancelled dan menerbitkan `chat_turn_status`.
- T-Line `SuperAgentConsoleUtils.ts:153-461` tidak memiliki cabang `chat_turn_status` khusus (unknown payload warning); main chat mengakhiri spinner pada `agent_event.done` dan `goal_done` tanpa membedakan outcome.
- Activity/queue terpisah bisa memuat status; tetapi chat utama dapat menunjukkan 'selesai' tanpa konfirmasi completion task.
- Perbaikan: reducer turn-ID yang menggabungkan events + durable ledger dan menampilkan status `completed`, `incomplete`, `failed`, `aborted` secara eksplisit; UI tidak menyebut Done = Success.

### ALG-07 [P1, conditional first-turn bug] Session baru dikirim lewat socket lama

- T-Line composer `SuperAgentConsole.tsx:834-855` dapat membuat sesi baru (`handleNewChat()`) tetapi segera memakai variabel WS lama.
- Bridge `superAgentBridge.ts:968-976` tepatnya menolak session ID yang tidak sama dengan ID yang terikat di URL WS.
- Jika path tersebut terpicu saat WS lama masih OPEN, prompt pertama ditolak. Perbaikan: tunggu binding WS sesi baru + readiness ack, lalu kirim tepat sekali dengan idempotency key lama.

### ALG-08 [P2, intentional parity gap] CLI commands belum semuanya executable pada desktop

- T-Line composer `SuperAgentConsole.tsx:743-783` memiliki registry/safe-parity router dan menolak CLI-only commands.
- Core capability manifest `src/core/channels/tlineCapabilities.ts:33-52` menandai command CLI sebagai metadata, bukan HTTP execution grant.
- Jangan mengatasi gap lewat generic shell executor. Buat typed allowlisted desktop actions untuk kebutuhan esensial, dengan permission serta audit Core.

### ALG-09 [P2, conditional context mismatch] Resume warning kehilangan detail di bridge

- Core `src/serverRoutes.ts:1223-1265` bisa mengembalikan `success: true` dengan `warning` ketika sejarah gagal dimuat di non-worker mode.
- T-Line `backend/src/superAgentBridge.ts:544-584` hanya mengembalikan boolean `!!parsed.success`; UI tidak memperoleh konteks gagal resume.
- Perbaikan: typed init ack mengandung historyRestored, warning, session identity; jangan mengaku percakapan lama dipahami ketika konteks gagal dimuat.

## Perbaikan bertahap

1. **P0 correctness:** ALG-01 dan ALG-02. Jaga idempotency no-post-replay, keamanan session, dan batas upload.
2. **P1 state & orchestration:** ALG-03 sampai ALG-07. Agent lifecycle Core adalah canonical, tidak buat agen palsu; satu typed event protocol dan replay.
3. **P2 parity & context:** ALG-08, ALG-09; perbaiki UX tanpa membuat agent engine kedua.
4. **Acceptance:** jalankan perintah identik pada CLI dan T-Line dalam project + preset/model yang sama; bandingkan classifier route, plan/approval, model, tool registry, call/result order, retry, memory compaction, outcome. Sertakan chat biasa, edit kode, tool chain 3 langkah, delegasi 2 subagent, gambar, long-context, mode switch, disconnect/reconnect. Lakukan tes aplikasi Tauri nyata, bukan hanya mocks.
5. **Safety/Git:** kedua repo `main`, ada perubahan Studio pihak lain yang belum di-commit. Stage hanya file milik task. Commit subject/body netral tanpa nama brand, dilarang menghapus fitur existing.

## Validasi audit sebelumnya

- 2026-10-27: T-Line backend focused tests **16 passed**; SuperAgent focused Core tests **55 passed**; T-Line frontend focused tests **16 passed**.
- Tes tersebut memvalidasi unit tertentu, **tidak membuktikan** first-turn readiness, multimodal parity, SSE cursor fidelity, multi-agent progress routing, atau installed native E2E.
- Audit ini **tidak** menjalankan sesi model/provider sungguhan dan **tidak** mengklaim perbaikan sudah selesai.
