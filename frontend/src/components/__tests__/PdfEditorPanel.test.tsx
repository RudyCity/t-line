import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  buildPdfEditorInstruction, defaultPdfEditDraft,
} from '../PdfEditorPanel';
import { FileViewerTab } from '../FileViewerTab';

vi.mock('../monacoSetup', () => ({ monaco: {} }));
vi.mock('@monaco-editor/react', () => ({
  default: () => null,
  loader: { config: vi.fn(), init: vi.fn(() => new Promise(() => {})) },
}));

const path = 'D:/project/safe-document.pdf';

describe('T-Line PDF editor handoff', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates a typed, inspect/verify-first PDF operation rather than silently writing a file', () => {
    const draft = defaultPdfEditDraft(path);
    draft.pages = '2, 5';
    draft.degrees = 270;
    const text = buildPdfEditorInstruction(path, draft);
    expect(text).toContain('pdf_inspect');
    expect(text).toContain('pdf_verify');
    const request = JSON.parse(text.split('User request JSON:\n')[1].split('\nReport the verified')[0]);
    expect(request).toEqual({
      inputPath: path, outputPath: 'D:/project/safe-document.edited.pdf',
      operations: [{ op:'rotate_pages',pages:[2,5],degrees:270 }],
    });
  });

  it('never authorizes overwrites, traversal to non-PDF input, or deletion without confirmation', () => {
    const draft = defaultPdfEditDraft(path);
    draft.outputPath = path;
    expect(() => buildPdfEditorInstruction(path,draft)).toThrow(/new .pdf output/);
    draft.outputPath = 'D:/project/copy.pdf';
    draft.pages = '1, 2, bad';
    expect(() => buildPdfEditorInstruction(path,draft)).toThrow(/Page numbers/);
    draft.pages='1';
    draft.kind='delete_pages';
    expect(() => buildPdfEditorInstruction(path,draft)).toThrow(/Confirm/);
    draft.destructiveConfirmed=true;
    expect(buildPdfEditorInstruction(path,draft)).toContain('"delete_pages"');
    expect(() => buildPdfEditorInstruction('ssh://remote/document.pdf',draft)).toThrow(/local PDF/);
  });

  it('creates restricted vector replacement and redaction prompts without faking arbitrary PDF text editing', () => {
    const draft = defaultPdfEditDraft(path);
    draft.kind = 'replace_exact';
    draft.pages = '2';
    draft.targetText = 'PRIVATE NOTE';
    draft.text = 'PUBLIC NOTE';
    const request = buildPdfEditorInstruction(path, draft);
    expect(request).toContain('pdf_edit_vector_exact');
    expect(request).toContain('"mode": "replace_exact"');
    expect(request).toContain('"targetText": "PRIVATE NOTE"');
    draft.kind = 'redact_exact';
    expect(() => buildPdfEditorInstruction(path, draft)).toThrow(/approve/);
    draft.destructiveConfirmed = true;
    const redact = buildPdfEditorInstruction(path, draft);
    expect(redact).toContain('"mode": "redact_exact"');
    expect(redact).toContain('"confirmRedact": true');
    draft.pages = '2, 3';
    expect(() => buildPdfEditorInstruction(path, draft)).toThrow(/precisely one/);
  });

  it('selects explicit embedded subset Latin Unicode original-text replacement, but refuses unicode redaction', () => {
    const draft=defaultPdfEditDraft(path);
    draft.kind='replace_exact';
    draft.pages='1';
    draft.vectorFontPolicy='embedded_subset';
    draft.targetText='Pendidikan – Cafe Ké';
    draft.text='Pendidikan – Café Ke';
    const instruction=buildPdfEditorInstruction(path,draft);
    expect(instruction).toContain('"fontPolicy": "embedded_subset"');
    expect(instruction).toContain('"targetText": "Pendidikan – Cafe Ké"');
    expect(instruction).toContain('glyphs already in the original embedded font subset');
    draft.kind='redact_exact';
    draft.destructiveConfirmed=true;
    expect(()=>buildPdfEditorInstruction(path,draft)).toThrow(/Embedded Unicode redaction/);
  });

  it('emits explicit bounded fit geometry only for embedded replacement', () => {
    const draft=defaultPdfEditDraft(path);
    draft.kind='replace_exact';
    draft.pages='1';
    draft.vectorFontPolicy='embedded_subset';
    draft.targetText='FAKULTAS TEKNOLOGI PERTANIAN';
    draft.text='Fakultas Teknologi Agroindustri dan Biosistem';
    draft.vectorFitEnabled=true;
    draft.vectorFitX0=70;
    draft.vectorFitY0=610;
    draft.vectorFitX1=278;
    draft.vectorFitY1=630;
    const instruction=buildPdfEditorInstruction(path,draft);
    expect(instruction).toContain('"fitBounds": {');
    expect(instruction).toContain('"x0": 70');
    expect(instruction).toContain('"y1": 630');
    expect(instruction).toContain('never below 65%');
    draft.vectorFitX1=65;
    expect(()=>buildPdfEditorInstruction(path,draft)).toThrow(/Fit bounds/);
    draft.vectorFitEnabled=false;
    expect(buildPdfEditorInstruction(path,draft)).not.toContain('"fitBounds"');
  });

  it('requires explicit signing approval and never places P12 passwords into prompts', () => {
    const draft = defaultPdfEditDraft(path);
    draft.kind = 'sign_document';
    draft.certificatePath = 'secrets/test.p12';
    draft.signerName = 'Signer Label';
    expect(() => buildPdfEditorInstruction(path, draft)).toThrow(/approve/);
    draft.destructiveConfirmed = true;
    const signing = buildPdfEditorInstruction(path, draft);
    expect(signing).toContain('pdf_sign');
    expect(signing).toContain('"certificatePath": "secrets/test.p12"');
    expect(signing).toContain('"confirmSign": true');
    expect(signing).toContain('SUPERAGENT_PDF_P12_PASSWORD');
    expect(signing).not.toContain('"password":');
  });

  it('sends signature validation as read-only separate OpenSSL and independent PAdES passes', () => {
    const draft = defaultPdfEditDraft(path);
    draft.kind = 'verify_signature';
    draft.outputPath = path;
    const verify = buildPdfEditorInstruction(path, draft);
    expect(verify).toContain('pdf_verify_signature');
    expect(verify).toContain('"inputPath":');
    expect(verify).not.toContain('"outputPath":');
    expect(verify).toContain('"verifyTrustedChain":false');
    expect(verify).toContain('"verifyIndependentPades":false');
    draft.verifyTrustedChain = true;
    const checked = buildPdfEditorInstruction(path, draft);
    expect(checked).toContain('"verifyTrustedChain":true');
    expect(checked).toContain('SUPERAGENT_PDF_CA_BUNDLE');
    draft.verifyOfflineCrl = true;
    draft.verifyTrustedChain = false;
    const withCrl = buildPdfEditorInstruction(path, draft);
    expect(withCrl).toContain('"verifyOfflineCrl":true');
    expect(withCrl).toContain('"verifyTrustedChain":true');
    expect(withCrl).toContain('SUPERAGENT_PDF_CA_CRL_BUNDLE');
    draft.verifyIndependentPades = true;
    const independent = buildPdfEditorInstruction(path, draft);
    expect(independent).toContain('Independent pyHanko pass JSON:');
    expect(independent).toContain('"verifyIndependentPades":true');
    expect(independent).toContain('SUPERAGENT_PDF_TSA_CA_BUNDLE');
    expect(independent).toContain('SUPERAGENT_PDF_OCSP_RESPONSE');
    expect(independent).toContain('network fetching disabled');
    expect(independent).toContain('Revocation without actual embedded/operator evidence is NOT proven');
  });

  it('makes searchable OCR a write-only copy with model and language, never disguised as visual redaction', () => {
    const draft = defaultPdfEditDraft(path);
    draft.kind = 'ocr_searchable';
    draft.pages = '1, 3';
    draft.outputPath = 'D:/project/safe-document.searchable.pdf';
    draft.ocrModel = 'tiny';
    draft.ocrLanguage = 'id';
    const req = buildPdfEditorInstruction(path, draft);
    expect(req).toContain('pdf_ocr_searchable');
    expect(req).toContain('"expectedInputSha256": "OBTAIN_FROM_PDF_INSPECT"');
    expect(req).toContain('"engine": "tiny"');
    expect(req).toContain('"language": "id"');
    expect(req).toContain('"pages": [');
    expect(req).toContain('NOT redaction');
    draft.pages = Array.from({length: 21}, (_, i) => i + 1).join(', ');
    expect(() => buildPdfEditorInstruction(path, draft)).toThrow(/20 distinct/);
  });

  it('requests read-only OCR without requiring an output PDF or accidental write permissions', () => {
    const draft = defaultPdfEditDraft(path);
    draft.kind = 'ocr_read';
    draft.outputPath = path;
    draft.ocrModel = 'tesseract';
    const req = buildPdfEditorInstruction(path, draft);
    expect(req).toContain('pdf_ocr');
    expect(req).not.toContain('"outputPath"');
    expect(req).not.toContain('"expectedInputSha256"');
    expect(req).toContain('"engine": "tesseract"');
  });

  it('renders the OCR mode and model selector and uses the existing Assistant callback once', () => {
    const cb = vi.fn();
    render(<FileViewerTab filePath={path} token="token" onRequestPdfEdit={cb}/>);
    fireEvent.click(screen.getByRole('button', {name:'Edit PDF with SuperAgent'}));
    fireEvent.change(screen.getByLabelText('Operation'), {target:{value:'ocr_searchable'}});
    fireEvent.change(screen.getByLabelText('OCR model'), {target:{value:'small'}});
    fireEvent.change(screen.getByLabelText('Document language'), {target:{value:'id'}});
    fireEvent.click(screen.getByRole('button', {name:'Create searchable PDF'}));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toContain('pdf_ocr_searchable');
    expect(cb.mock.calls[0][0]).toContain('"engine": "small"');
    expect(cb.mock.calls[0][0]).toContain('"language": "id"');
  });

  it('uses typed AcroForm inputs, rejects invalid choices, and requires explicit flatten approval', () => {
    const draft=defaultPdfEditDraft(path);
    draft.kind='fill_form';
    draft.field='consent';
    draft.formValueType='checkbox';
    draft.formChecked=true;
    draft.flattenForm=true;
    const checked=buildPdfEditorInstruction(path,draft);
    expect(checked).toContain('"value": true');
    expect(checked).toContain('"op": "flatten_forms"');
    expect(checked).not.toContain('"pages"');
    expect(checked).toContain('read-only');
    draft.formValueType='choice';
    draft.text='';
    expect(()=>buildPdfEditorInstruction(path,draft)).toThrow(/existing PDF form option/);
    draft.text='Agroindustri';
    expect(buildPdfEditorInstruction(path,draft)).toContain('"value": "Agroindustri"');
  });

  it('renders typed form field controls and hands off through the existing Assistant', () => {
    const onRequest=vi.fn();
    render(<FileViewerTab filePath={path} token="token" onRequestPdfEdit={onRequest}/>);
    fireEvent.click(screen.getByRole('button',{name:'Edit PDF with SuperAgent'}));
    fireEvent.change(screen.getByLabelText('Operation'),{target:{value:'fill_form'}});
    fireEvent.change(screen.getByLabelText('Exact form field name'),{target:{value:'consent'}});
    fireEvent.change(screen.getByLabelText('Field type'),{target:{value:'checkbox'}});
    fireEvent.click(screen.getByLabelText('Checked (uncheck to set false)'));
    fireEvent.click(screen.getByLabelText(/Flatten completed form/));
    fireEvent.click(screen.getByRole('button',{name:/Edit with SuperAgent/}));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0][0]).toContain('"value": true');
    expect(onRequest.mock.calls[0][0]).toContain('"op": "flatten_forms"');
  });

  it('opens the existing viewer panel and requests a single Assistant handoff on explicit click', () => {
    const onRequest = vi.fn();
    render(<FileViewerTab filePath={path} token="token" onRequestPdfEdit={onRequest}/>);
    expect(onRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Edit PDF with SuperAgent'}));
    expect(screen.getByRole('complementary',{name:'PDF editing options'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Edit with SuperAgent/})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/Edit with SuperAgent/}));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onRequest.mock.calls[0][0]).toContain('expectedInputSha256');
    expect(onRequest.mock.calls[0][0]).toContain('pdf_verify');
  });

  it('does not offer the write UI when no Assistant handoff callback is available', () => {
    render(<FileViewerTab filePath={path} token="token"/>);
    expect(screen.queryByRole('button',{name:'Edit PDF with SuperAgent'})).not.toBeInTheDocument();
  });
});
