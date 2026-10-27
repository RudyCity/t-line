# Audit Implementasi — Studio Desktop Editor & Unified Agent Control

**Tanggal:** 2026-10-27  
**Repository:** T-Line desktop + SuperAgent Core  
**Dokumen acuan:** `docs/plans/2026-10-27-studio-desktop-editor-agent-control-master-plan.md`  
**Baseline implementasi:** T-Line commit `8bdb556`, versi `1.3.747`  
**Status:** **NOT COMPLETE / NOT PRODUCTION READY**  
**Jenis audit:** inspeksi kode pada kedua repository + tes frontend terfokus; **bukan** sertifikasi aplikasi desktop terpasang.  
**Audience:** AGY / implementing coding agent.

> **Instruksi eksekusi:** Jangan sekadar merapikan UI atau menambah tes dummy. Tuntaskan gap yang terbukti, mulai dari integritas proyek dan keamanan kontrol agent, sampai satu vertical slice chat -> edit -> preview -> undo -> reopen yang nyata. Pertahankan seluruh fitur existing. Catat bukti per gate sebelum mengubah status fase menjadi selesai.

## 1. Keputusan produk dan arsitektur (tidak boleh berubah)

- **T-Line adalah aplikasi desktop.** T-Line bukan tool server/MCP publik independen.
- **SuperAgent Core/CLI adalah satu runtime agent dan penyedia tools** yang tetap bisa digunakan di luar T-Line.
- **SuperAgent Assistant di T-Line adalah satu-satunya AI Director untuk Studio.** Tab Studio adalah editor manual timeline-first, **tanpa chat AI Director kedua**. Layanan generator, media analysis, vision, dan efek boleh tetap ada sebagai kemampuan/tools, bukan chat kedua.
- **Satu source of truth:** proyek, timeline, media, revisions, render jobs dan history dimiliki SuperAgent Core. UI manusia dan agent harus mengedit proyek yang sama, dengan revision check dan provenance.
- **Target editor desktop:** Media Bin/thumbnail kiri, video preview besar tengah, inspector kanan, timeline video+audio multi-track lebar penuh di bawah, toolbar/export ringkas, layout yang dapat di-resize. Gunakan komponen yang sudah ada lebih dahulu.
- **Keamanan:** per-workspace authorization, exact project target, operasi destructive memerlukan approval sesuai mode izin, no cross-workspace fallback, idempotency dan fail-closed.
- **Git:** commit menggunakan deskripsi engineering netral **tanpa brand** di subject maupun body. Stage file secara eksplisit; jangan mengambil file milik agent lain.

## 2. Audit summary

| Fase | Status audit | Bukti dan alasan |
|---|---|---|
| P0 Contract/capability inventory | **PARTIAL** | Inventaris dan interface dibuat, tetapi mencampur tool existing dengan tool yang belum terdaftar / belum berfungsi end-to-end. |
| P1 Editor UI / remove Director | **PARTIAL** | Split/Prompt topbar dihapus, workstation 3 kolom ada; `StudioQuickDirectPanel` masih menjadi AI Director dalam Studio, sementara `StudioMediaBin` baru belum dipasang. |
| P2 Unified Assistant & desktop focus | **PARTIAL / BLOCKED** | Tool Core terdaftar dan channel lokal ada, tetapi payload Core dan UI tidak cocok, dan integrasi otomatis assistant -> desktop belum terbukti. |
| P3 Live edits, approval & conflict | **PARTIAL / BLOCKED** | Core revision checking ada; realtime event hanya emitter memory frontend, tanpa persisted sequence/reconnect catch-up. Scope fallback berbahaya. |
| P4 Clip-based NLE | **PARTIAL / BLOCKED** | Komponen timeline dan pure operations ada; clip video tidak persisted; trim/move/snap tidak terhubung ke gesture UI. |
| P5 Agent video workflow | **NOT DONE** | Belum ada bukti workflow nyata dari chat hingga MP4 yang melibatkan clip, captions, musik, persetujuan dan export. |
| P6 Performance/native robustness | **NOT VERIFIED** | Belum ada benchmark, long-project soak, dan native Windows installed-app E2E. |
| P7 Rollout/migration | **NOT DONE** | Migrasi schema clip, rollback, feature flag dan production acceptance belum disertifikasi. |

**Putusan:** commit `8bdb556` adalah fondasi implementasi, **bukan** bukti P0–P7 selesai. P0/P1/P2/P3/P4 belum boleh ditutup sebelum gate masing-masing lulus.

## 3. Daftar temuan, tingkat risiko, dan bukti kode

### AUD-01 [BLOCKER] Clip video hasil split/trim tidak tersimpan di canonical project

**Bukti:**
- `frontend/src/services/studioControlTypes.ts:89-95`: tipe `StudioClipNleComposition` v2 hanya didefinisikan di frontend.
- `frontend/src/services/studioControlTypes.ts:95-154`: track video dibangun ulang dari semua layer dengan `startFrame = 0` dan `durationFrames = comp.durationFrames`.
- `frontend/src/services/studioClipEdits.ts:289-318`: `syncClipsToComposition()` hanya menyimpan durasi dan audio, **tidak** menyimpan posisi, hasil split, clip ID, trims, atau multiple video clips.
- `frontend/src/components/studio/StudioMultiTrackTimeline.tsx:56-64`: `tracks` dibangun ulang dari composition saat berubah.
- `frontend/src/components/StudioTab.tsx:666-682`: hasil timeline dikirim sebagai `replace-composition`, padahal detail clip video tidak tercakup di composition v1.

**Dampak:** split/move/ripple dapat terlihat sementara di UI tetapi hilang setelah refresh/reopen; konflik editor-manual vs agent dapat menghapus hasil edit. **Ini risiko data integrity**, bukan masalah kosmetik.

**Perbaikan wajib:**
1. Definisikan model clip/track v2 di **SuperAgent Core schema + storage + validation**, bukan frontend-only.
2. Sediakan migration/upcast v1 -> v2 yang idempotent dan tidak merusak proyek lama.
3. Buat typed atomic commands: insert/split/trim/move/ripple/delete, lock/mute, dengan base revision dan server-side validation.
4. Media source references, trim in/out, start/end, urutan tracks, clip IDs, audio sync harus round-trip secara lossless.
5. Jangan gunakan `replace-composition` generik untuk menyimpan susunan clip jika payload tidak memiliki skema NLE lengkap.
6. Reopen dan render proyek hasil editing harus menghasilkan timeline/video yang sama.

**Gate:** buat proyek -> masukkan 3 clip asli -> split/trim/move/ripple -> save -> reload/restart -> inspect -> undo/redo -> render MP4 -> verify hasil. Semua perubahan harus bertahan dan dapat dibatalkan.

### AUD-02 [BLOCKER] Tool-to-desktop focus action memakai kontrak payload yang tidak konsisten

**Bukti:**
- SuperAgent `src/core/tools/motionAgentTools.ts:308-337`: `studio_desktop_focus` mengembalikan JSON dengan `action: "studio_control_action"`, `type: "focus_studio"`, `studioId`, tanpa `workspacePath` / `projectId` yang dibutuhkan channel.
- T-Line `frontend/src/components/SuperAgentToolItem.tsx:293-354`: navigasi hanya menampilkan project berdasarkan `projectId` atau `result.receipt.projectId`, padahal tool Core mengembalikan `studioId`.
- `SuperAgentToolItem.tsx:340-349`: `args.action || result.action` dapat berupa **string**, lalu dikirim ke `emitAction` yang membutuhkan objek `StudioControlAction`.
- `frontend/src/services/studioControlChannel.ts:30-39`: string/tanpa `workspacePath` diam-diam diabaikan.

**Dampak:** assistant dapat melaporkan bahwa Studio sudah difokuskan, padahal action hanya menghasilkan JSON dan tidak terjadi perpindahan UI.

**Perbaikan wajib:** normalisasi respons Core menjadi satu typed envelope dengan `workspacePath`, `projectId`, `type` dan params valid; parse dan validasi runtime sebelum dispatch; perbaiki pemetaan `studioId` ↔ `projectId`; return explicit status `queued / delivered / refused`; jangan klaim `updated` jika belum ada ack dari desktop.

**Gate:** dari chat Assistant, jalankan focus/open project/seek/select clip pada desktop terbuka dan desktop yang baru dibuka; verifikasi project dan frame benar. Uji malformed payload, absent workspace, stale project, unknown action.

### AUD-03 [HIGH] Cross-workspace fallback tidak fail-closed

**Bukti:** `frontend/src/hooks/useStudioHandoff.ts:24-41` jatuh ke `panelWorkspace` ketika `action.workspacePath` tidak cocok dengan workspace terdaftar.

**Dampak:** permintaan untuk workspace A bisa membuka Studio workspace B; berisiko salah edit jika tindakan lanjutan mengikuti state yang keliru.

**Perbaikan wajib:** hapus fallback saat action memiliki path target explicit; target tidak ditemukan harus error eksplisit, tidak boleh redirect diam-diam. Validasi kembali project membership di Core untuk setiap mutation; gunakan canonical workspace ID/path mapping yang terautentikasi.

**Gate:** forged/unknown path, case and separator normalization, nonmember project, 2 workspace terbuka; **tidak boleh pernah** mengalihkan ke workspace lain.

### AUD-04 [HIGH] AI Director kedua masih hadir di editor

**Bukti:**
- `frontend/src/components/StudioTab.tsx:231-279`: saat project kosong, kolom kiri adalah `StudioQuickDirectPanel`.
- `frontend/src/components/StudioTab.tsx:340-347`: project aktif masih menampilkan accordion `AI Studio Director` dengan `StudioQuickDirectPanel`.
- `frontend/src/components/studio/StudioQuickDirectPanel.tsx`: prompt panel aktif di luar chat Assistant.

**Perbaikan wajib:** hapus standalone Director UI dari Studio screen. Pindahkan / ekspos workflow generasi dan revisi ke tools/assistant command yang ada, bukan menghapus engine kemampuannya. Empty state editor harus fokus ke project picker / import media / create project. Jangan menambah chat baru di Studio.

**Gate:** tidak ada AI Director kedua, Prompt/Split modes, atau histori chat terpisah pada UI Studio; seluruh tugas AI dapat dipicu dari Assistant T-Line.

### AUD-05 [HIGH] Media Bin yang dibuat belum terintegrasi

**Bukti:** `frontend/src/components/studio/StudioMediaBin.tsx` sudah ada, tetapi `StudioTab.tsx` tidak mengimport atau merender komponen tersebut; saat ini hanya `StudioLayersSection` langsung.

**Gap fungsi:** `StudioMediaBin.tsx:134-151` baru menampilkan informasi import dan tombol yang mengarah ke import gambar; belum memperlihatkan koleksi thumbnail video/audio, duration, source metadata, atau drag-to-timeline sebenarnya.

**Perbaikan wajib:** integrasi asset list Core, thumbnail, duration/fps/resolution, waveform, browse/import video & audio yang didukung engine, drag clip ke track, pencarian/filter, missing-media handling; bukan sekadar kartu statis.

**Gate:** import 3 aset lokal -> thumbnail muncul -> drag ke track -> preview sesuai media -> save/reopen tetap valid.

### AUD-06 [HIGH] Timeline actions masih sebagian prototype

**Bukti:**
- `frontend/src/services/studioClipEdits.ts:64-108,178-233` punya fungsi `trimClip()` dan `moveClip()`, tetapi `StudioMultiTrackTimeline.tsx` belum memakai fungsi tersebut dalam gesture clip.
- `frontend/src/components/studio/StudioMultiTrackTimeline.tsx:453-493` clip hanya diberi `onClick` (select), belum tersedia pointer drag/trim handles.
- `StudioMultiTrackTimeline.tsx:66-68,198-207` snap/mute/lock hanya state lokal. Track saat ini hanya diturunkan dari composition ke Video 1 + Audio 1.
- `frontend/src/services/studioClipEdits.ts:289-318` hanya menyimpan audio track pertama; ketika semua audio dihapus, jalur ini juga tidak secara eksplisit membersihkan audio lama.

**Perbaikan wajib:** implement UI drag/move/trim/ripple/snap dengan undo + persistence yang benar; multi-lane real, video overlays, text overlays, per-track mute/lock di Core, timecode/framerate validation, audio-only handling.

**Gate:** 3+ video clips, 2+ audio tracks, clip overlay, snap toggle, mute/lock, trim from both ends; edit bertahan setelah reload, playback dan export sesuai project data.

### AUD-07 [HIGH] Event bus hanya lokal, belum real-time Core dengan replay

**Bukti:**
- `frontend/src/services/studioControlChannel.ts:11-16,48-103`: `Set` listener dan `sequenceCounter` dalam memory frontend.
- `frontend/src/components/StudioTab.tsx:64-72`: event revision dipancarkan berdasarkan state UI lokal, bukan authoritative commit stream.
- Tidak ada bukti persisted event sequence, replay cursor dan server-to-desktop streaming untuk Studio pada implementasi commit ini.

**Perbaikan wajib:** event stream dari Core yang memiliki project/workspace ID dan sequence yang dapat direkonsiliasi; reconnect -> inspect latest revision; dedupe by operation ID; event disampaikan hanya setelah edit canonical berhasil; UI harus bisa membedakan pending/confirmed/rejected.

**Gate:** lakukan edit dari agent ketika Studio terbuka dan ketika tab tertutup; reconnect / refresh; UI sinkron tanpa replay mutation atau overwrite perubahan manual.

### AUD-08 [HIGH] Operasi edit/receipt belum memiliki idempotency dan approval terpadu

**Bukti:**
- SuperAgent `src/core/tools/motionAgentTools.ts:252-306`: `studio_edit_project` menerima `studioId`, `expectedRevision`, `edits` lalu memanggil `updateMotionProject`; receipt dibuat setelahnya dengan `operationId` acak. Tidak tampak idempotency key dari caller sebelum operasi maupun pengikatan approval pada method ini.
- UI `SuperAgentToolItem.tsx:301-318` mengharapkan `result.receipt`, sedangkan Tool Core mengembalikan receipt sebagai **objek root**.
- `frontend/src/services/studioControlTypes.ts:15-60` mendefinisikan intent/receipt/event, tetapi kontrak tersebut belum dipakai lintas boundary secara konsisten.

**Perbaikan wajib:** request operation ID + actor/session + workspace/project + expectedRevision, idempotency store sebelum mutation, approval policy dengan perbedaan no-YOLO / YOLO / full-YOLO dan explicit approval untuk overwrite/destructive/bulk/export. Return success/failure receipt seragam; UI tidak menampilkan successful receipt untuk error.

**Gate:** two identical calls do not double-apply, stale revision returns conflict, approval denial never mutates project, receipt links to actual confirmed revision and undo checkpoint.

### AUD-09 [MEDIUM/HIGH] Desktop focus dan clip selection tidak lengkap

**Bukti:** `frontend/src/components/StudioTab.tsx:42-62` menangani open_project, seek_timecode dan select_clip hanya jika ada `layerId`; `clipId` tidak dipakai untuk memilih clip di `StudioMultiTrackTimeline`, dan `select_panel` tidak ditangani. `useStudioHandoff` hanya fokus tab.

**Perbaikan wajib:** selected clip state harus dapat dikontrol secara terarah, panel actions didukung atau secara eksplisit ditolak; project check untuk setiap action; desktop acknowledgement/timeout dan pending focus state untuk tab yang belum mount.

**Gate:** chat -> select clip by clipId -> scroll & highlight track lane -> seek timecode -> inspector opens matching clip.

### AUD-10 [MEDIUM] P0 inventory dan changelog terlalu optimistis

**Bukti:** `docs/plans/2026-10-27-studio-capability-inventory.md:3` menyatakan `Complete (P0 Gate)`, dan baris 26 mencantumkan `studio_clip_edit` seolah operation tersedia. Penelusuran SuperAgent Core hanya membuktikan `studio_list_projects`, `studio_inspect_project`, `studio_edit_project`, `studio_desktop_focus`; tidak ditemukan tool implementasi `studio_clip_edit` di source terkait.

**Perbaikan wajib:** capability matrix pecahkan menjadi `exists in Core`, `exists as frontend helper`, `wired to chat`, `persists`, `E2E verified`; tandai missing sesuai fakta. Jangan klaim fase lengkap hanya karena type atau komponen dibuat.

## 4. Status tes dan batas verifikasi

**Dijalankan pada baseline 8bdb556:**
- Enam file tes Vitest terkait Studio: **51/51 lulus** (exit code 0).
- Frontend `bun run build`: TypeScript/Vite menyelesaikan transformasi dan mencetak `built in 1m 10s`; pembungkus eksekusi yang digunakan **tidak mengembalikan exit code final**, sehingga catat sebagai output build teramati, bukan sertifikasi yang final.
- Tidak dilakukan live GUI Studio E2E, native installed-app smoke, runtime edit nyata, media import nyata, E2E 3 clip dan render MP4.
- Pada pemeriksaan proses sebelumnya frontend 5773 dan backend 5779 tidak listening. Log Tauri lama pernah menunjukkan akses ditolak saat mengganti `target/debug/app.exe` (os error 5), **bukan bukti penyebab build saat ini**.

**Unit tests passing != fitur berfungsi penuh.** Tambahkan tes integration/Core dan uji native, terutama persistence, security dan konflik.

## 5. Execution backlog untuk AGY (urut wajib)

### Sprint A — DATA INTEGRITY + TRUST (release blockers)
- [ ] **A1** Definisikan NLE clip/track schema di Core, migrasi v1->v2 dan revisioned clip CRUD; pastikan persist & rollback.
- [ ] **A2** Samakan kontrak `studioId/projectId` dan `studio_desktop_focus` dari Core ke T-Line; schema validation + UI acknowledgement.
- [ ] **A3** Hilangkan unsafe `panelWorkspace` fallback dan pastikan project/workspace isolation.
- [ ] **A4** Idempotency, approval & revision conflict policy untuk seluruh mutasi agent.
- [ ] **A5** E2E: chat -> inspect -> edit satu layer -> approved revision -> preview -> undo -> reopen; simpan evidence.

### Sprint B — EDITOR EXPERIENCE
- [ ] **B1** Cabut semua UI AI Director mandiri, gunakan Assistant tunggal.
- [ ] **B2** Render `StudioMediaBin` yang benar dan hubungkan data Core + thumbnails, bukan sekadar statis.
- [ ] **B3** Layout resizable, preview dominan, inspector kanan, timeline multi-track tinggi dan scroll konsisten.
- [ ] **B4** Koneksikan drag/move/trim/snap/ripple/lock/mute ke model Core; timecode, waveform, clip inspector.
- [ ] **B5** E2E editor manual: import -> 3 clips -> edit -> preview -> save -> restart -> render.

### Sprint C — AGENT VIDEO WORKFLOW + RECOVERY
- [ ] **C1** Buat tools studio video editing yang benar-benar memanggil canonical Core clip APIs.
- [ ] **C2** Realtime event source Core, reconnect catch-up, operation receipts, pending/error handling, human takeover.
- [ ] **C3** Subtitle/caption flow, music/voiceover flow, effects/transition and export controls with risk approvals.
- [ ] **C4** Uji perintah 30-second promo pada aset lokal sesungguhnya, hasil MP4 terverifikasi.
- [ ] **C5** Profiling playback, thumbnail/proxy caching, soak, crash recovery, packaged Windows QA, rollback.

## 6. Acceptance criteria wajib sebelum bilang “selesai”

1. **Architecture:** Satu Assistant dan satu project state; tidak ada duplicate Director chat atau duplicate backend.
2. **Persistence:** Semua clip/track operations bertahan setelah refresh, restart dan re-open; video hasil render sesuai timeline.
3. **Workspace safety:** malformed/missing/foreign workspace/project action ditolak dan tidak mengubah UI/proyek lain.
4. **AI control:** tools Assistant benar-benar menggerakkan Studio terpasang, bukan return JSON tanpa efek; ack jelas.
5. **Revision & idempotency:** dua agent + satu human dapat edit tanpa silent overwrite; concurrent update konflik dengan respons nyata; duplicate operation tidak digandakan.
6. **Permission modes:** no-YOLO, YOLO dan full-YOLO mematuhi policy; destructive/export punya approval wajib sesuai risiko.
7. **UX:** Media library dengan thumb, preview, inspector, multitrack editor, drag/trim/split/snap/zoom/scrub; desktop narrow/resizable lolos smoke.
8. **E2E:** minimal satu video nyata dari project 3 clips + 2 audio tracks melalui chat->approval->edit->preview->MP4, manual handover dan undo.
9. **Quality:** existing Studio capabilities preserved; regression tests + Core integration tests + Windows native packaged smoke evidence.
10. **Documentation:** per fase update status, known limitations, CHANGELOG, versi, dan commit messages netral tanpa brand; tidak klaim production-ready tanpa bukti.

## 7. Reporting format wajib dari AGY

Untuk setiap issue AUD-01..AUD-10 kirim:
- Status: `DONE | PARTIAL | BLOCKED`.
- Changed files + concise rationale + commit hash.
- Test commands dan hasil exit code.
- Bukti E2E nyata (input assets/project ID non-rahasia, revision before/after, render artifact/job, reopen verification). Jangan sertakan kredensial atau token.
- Outstanding gaps, rollback dan risiko.

**Jangan mark P0/P4/P5 complete sebelum AUD-01, AUD-02, AUD-03, AUD-08 dan uji persistence/chat E2E benar-benar lulus.** Selesaikan perubahan secara bertahap, tidak menghapus fitur, jangan stop shared SuperAgent Core milik agent lain, jangan menjalankan restart paksa, dan jangan push sebelum diminta.

## 8. Instruksi singkat siap kirim ke AGY

> Audit dokumen `docs/audits/2026-10-27-studio-desktop-editor-agent-control-implementation-audit.md` terhadap master plan `docs/plans/2026-10-27-studio-desktop-editor-agent-control-master-plan.md`. Kerjakan seluruh issue **AUD-01 s.d. AUD-10** dan Sprint A-C berdasarkan prioritas. Wajib pastikan chat SuperAgent Assistant T-Line menjadi satu-satunya AI Director, Studio benar-benar editor desktop timeline-first, clip edits persist di Core, dan tool-to-desktop benar-benar berjalan. Jalankan tes Core+frontend+desktop, buktikan E2E real media sampai MP4 serta recovery/undo, update status dokumen dan changelog sesuai bukti. Reuse komponen, lindungi perubahan lain, stage eksplisit, commit tanpa brand di subject/body, jangan push kecuali diminta. Jangan mengklaim fase selesai jika belum memenuhi acceptance gate.
