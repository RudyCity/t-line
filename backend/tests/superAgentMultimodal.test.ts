import { describe, expect, it } from 'bun:test';
import {
  validateAndSanitizeMultimodalInput,
  isModelMultimodalCapable,
} from '../src/superAgentMultimodal';

describe('superAgentMultimodal', () => {
  const dummyBase64 = Buffer.from('fake-image-binary-data-for-testing').toString('base64');

  it('accepts text only message', () => {
    const res = validateAndSanitizeMultimodalInput('Hello assistant');
    expect(res.valid).toBe(true);
    expect(res.sanitizedParts).toEqual([{ type: 'text', text: 'Hello assistant' }]);
    expect(res.cleanHistoryText).toBe('Hello assistant');
  });

  it('accepts text + single image part with clean history text (no raw base64)', () => {
    const parts = [
      {
        type: 'image',
        mimeType: 'image/png',
        image: dummyBase64,
        name: 'chart.png',
      },
    ];
    const res = validateAndSanitizeMultimodalInput('Explain this chart', parts, 'claude-3-5-sonnet-20241022');
    expect(res.valid).toBe(true);
    expect(res.sanitizedParts).toHaveLength(2);
    expect(res.sanitizedParts![0]).toEqual({ type: 'text', text: 'Explain this chart' });
    expect(res.sanitizedParts![1].type).toBe('image');
    // Ensure cleanHistoryText does NOT contain the raw base64 string
    expect(res.cleanHistoryText).not.toContain(dummyBase64);
    expect(res.cleanHistoryText).toContain('Explain this chart');
    expect(res.cleanHistoryText).toContain('[image: chart.png]');
  });

  it('accepts two images in a single turn', () => {
    const parts = [
      {
        type: 'image',
        mimeType: 'image/jpeg',
        image: dummyBase64,
        name: 'before.jpg',
      },
      {
        type: 'image',
        mimeType: 'image/png',
        image: dummyBase64,
        name: 'after.png',
      },
    ];
    const res = validateAndSanitizeMultimodalInput('Compare these two images', parts, 'gpt-4o');
    expect(res.valid).toBe(true);
    expect(res.sanitizedParts).toHaveLength(3);
    expect(res.sanitizedParts!.filter((p) => p.type === 'image')).toHaveLength(2);
    expect(res.cleanHistoryText).toContain('[image: before.jpg]');
    expect(res.cleanHistoryText).toContain('[image: after.png]');
  });

  it('strips Data URL prefix when client sends data:image/...;base64,...', () => {
    const parts = [
      {
        type: 'image',
        mimeType: 'image/png',
        image: `data:image/png;base64,${dummyBase64}`,
      },
    ];
    const res = validateAndSanitizeMultimodalInput('Check this', parts);
    expect(res.valid).toBe(true);
    const imgPart = res.sanitizedParts!.find((p) => p.type === 'image') as any;
    expect(imgPart.image).toBe(dummyBase64);
    expect(imgPart.image).not.toContain('data:image/png;base64,');
  });

  it('rejects unsupported image MIME type', () => {
    const parts = [
      {
        type: 'image',
        mimeType: 'image/bmp',
        image: dummyBase64,
      },
    ];
    const res = validateAndSanitizeMultimodalInput('Inspect', parts);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Unsupported image format "image/bmp"');
  });

  it('rejects when active model is text-only (unsupported-model fallback)', () => {
    const parts = [
      {
        type: 'image',
        mimeType: 'image/png',
        image: dummyBase64,
      },
    ];
    expect(isModelMultimodalCapable('gpt-3.5-turbo')).toBe(false);
    const res = validateAndSanitizeMultimodalInput('Analyze this', parts, 'gpt-3.5-turbo');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('does not support image attachments');
  });

  it('rejects oversize image input exceeding 10 MiB limit', () => {
    // 11 MiB in base64 string length ~ 15 million chars
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const largeBase64 = largeBuffer.toString('base64');
    const parts = [
      {
        type: 'image',
        mimeType: 'image/png',
        image: largeBase64,
      },
    ];
    const res = validateAndSanitizeMultimodalInput('Analyze large image', parts);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Image attachment is too large');
  });
});
