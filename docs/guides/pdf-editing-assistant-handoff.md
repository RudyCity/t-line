# PDF Editing in T-Line — Local SuperAgent Assistant Handoff

Date: 2026-11-04
Status: Source complete, frontend build and focused tests PASS. Installed desktop/runtime activation NOT performed.

## Workflow

1. Open a **local PDF inside a registered T-Line workspace**. The existing browser PDF viewer remains intact.
2. Click **Edit PDF** in the PDF viewer header.
3. Choose a typed operation: rotate pages; add page numbers; add text; watermark; highlight overlay; fill existing AcroForm field (text, listed choice or checkbox, optionally flatten); or remove selected pages from a new PDF.
4. Select page numbers (1-based) or leave blank where applicable. For ordinary added text, optionally supply a TTF/OTF font file **inside the authorized workspace** to render Unicode characters.
   For advanced operations, the same inspector now provides:
   - Restricted **replace exact text** or **redact exact text** (Standard-14 Tj/TJ/multi-Tj, or opt-in embedded Type0/Identity-H Latin Unicode Tj/bounded TJ using existing glyphs only). Embedded replacement can preserve untouched Image XObjects and simple sequential ToUnicode bfrange mappings. Optional **bounded fit** lets the user explicitly approve an x0/y0/x1/y1 page region; Core must keep the baseline and result inside it and will not horizontally scale below 65%. This is still not general document reflow.
   - **Sign with PKCS#12** using the host-only SUPERAGENT_PDF_P12_PASSWORD, explicit consent, and a certificate in the authorized project
   - **Verify CMS signature** read-only with OpenSSL, keeping certificate trust/revocation status explicitly separate
   - **Read PDF with local OCR**: read-only pretrained PP-OCRv6 Tiny/Small/Medium or Tesseract; exposes actual OCR engine/native text extraction provenance
   - **Create searchable PDF**: authorized WRITE action creating a new copy with an invisible selectable OCR text layer and independent visual pixel-parity verification, not redaction
5. Enter a **new output PDF path**. The editor blocks requests with the same source/output path, bad page numbers and unconfirmed page removal.
6. Click **Edit with SuperAgent**. T-Line selects the registered workspace, opens its existing Assistant tab, waits for the session socket/preset and hands over one instruction. It **does not write files directly** or create a new backend.
7. In SuperAgent, normal mode, discovery and permission checks apply: inspect source, obtain SHA-256, call `pdf_edit`, verify the output. A denied/unavailable tool is reported as a blocker.

## Limits

- This is not a lossless original-text editing canvas. Text and visual highlights are overlays and do not delete underlying content.
- Form filling now uses strict, typed values; inspect field names/options first. Read-only, dynamic XFA and signature fields are unsupported. The Core reopens filled forms to verify values and checks flattened PDFs before publishing. Form widget visual appearance on all viewers is not independently certified.
- General vector-preserving redaction, arbitrary paragraph reflow and qualified signature trust certification are not supported. Exact original-text edits are **restricted** to verified Tj/TJ patterns and fail closed on unsupported/inherited CMaps, missing glyphs, excessive kerning, Form/unknown XObjects or unverified layout structures. Image XObjects are only preserved for replacement, not treated as safe for exact redaction.
- The UI sends **one explicit user request** to the existing session. It does not silently auto-save PDF changes or overwrite originals.
- If the current Core owner is old, it will not see the new PDF toolset until a coordinated operator-approved restart. The T-Line source build alone does not activate live tools.
- Native installed Tauri E2E (PDF file tab → existing Assistant → authorized tool call → verify → reopen output) remains a release gate.
- Do not promote `superagent-pdf-stdio --allow-write` as an alternative public network endpoint: it has different auth properties from the primary MCP server.

## Verification

- UI tests (PDF panel): `cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/PdfEditorPanel.test.tsx` → **12/12 PASS**, including OCR model/language selection, typed AcroForm text/choice/checkbox controls, optional flattening and read/write handoff.
- TypeScript `cd frontend && bun --bun x tsc --noEmit` → **PASS**.
- `bun run build:frontend` → **PASS**, with Vite dependency-chunk warnings unrelated to this change.

## Source files

- `frontend/src/components/PdfEditorPanel.tsx` (new editor inspector)
- `frontend/src/components/FileViewerTab.tsx` (existing viewer integration)
- `frontend/src/App.tsx` (workspace-aware one-shot handoff)
- `frontend/src/components/SuperAgentConsole.tsx` (same Assistant session path)
- `frontend/src/components/__tests__/PdfEditorPanel.test.tsx` (new tests)

Build/release metadata, installed desktop acceptance and commits are deferred pending release authorization.
