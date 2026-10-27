import { describe, expect, it } from 'vitest';
import {
  prepareMultimodalPrompt,
  CLIENT_MAX_IMAGE_SIZE_BYTES,
  type AttachmentItem,
} from '../superAgentMultimodalClient';

describe('superAgentMultimodalClient', () => {
  const createMockFile = (name: string, type: string, size = 1024): File => {
    const blob = new Blob(['sample-file-content'], { type });
    return new File([blob], name, { type });
  };

  it('prepares text + single image without raw base64 in cleanDisplayText', async () => {
    const imgFile = createMockFile('diagram.png', 'image/png');
    const attachments: AttachmentItem[] = [{ type: 'image', file: imgFile }];

    const res = await prepareMultimodalPrompt('Analyze this architecture', attachments, async () => '');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.submission.parts).toHaveLength(2);
    expect(res.submission.parts[0]).toEqual({ type: 'text', text: 'Analyze this architecture' });
    expect(res.submission.parts[1].type).toBe('image');
    expect(res.submission.parts[1].mimeType).toBe('image/png');
    expect(res.submission.parts[1].name).toBe('diagram.png');

    // Clean display text must NOT have base64 or Data URLs
    expect(res.submission.cleanDisplayText).toContain('Analyze this architecture');
    expect(res.submission.cleanDisplayText).toContain('📎 diagram.png');
    expect(res.submission.cleanDisplayText).not.toContain('data:image');
    expect(res.submission.cleanDisplayText).not.toContain('base64');
  });

  it('prepares prompt with two images', async () => {
    const img1 = createMockFile('view1.jpg', 'image/jpeg');
    const img2 = createMockFile('view2.png', 'image/png');
    const attachments: AttachmentItem[] = [
      { type: 'image', file: img1 },
      { type: 'image', file: img2 },
    ];

    const res = await prepareMultimodalPrompt('Compare views', attachments, async () => '');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.submission.parts.filter((p) => p.type === 'image')).toHaveLength(2);
    expect(res.submission.cleanDisplayText).toContain('view1.jpg');
    expect(res.submission.cleanDisplayText).toContain('view2.png');
  });

  it('rejects unsupported image format (e.g. BMP/TIFF)', async () => {
    const bmpFile = createMockFile('drawing.bmp', 'image/bmp');
    const attachments: AttachmentItem[] = [{ type: 'image', file: bmpFile }];

    const res = await prepareMultimodalPrompt('Check this BMP', attachments, async () => '');
    expect(res.success).toBe(false);
    if (res.success) return;

    expect(res.error).toContain('Unsupported image format "drawing.bmp"');
  });

  it('rejects oversize image input exceeding 10 MiB limit', async () => {
    // Create File with size property mocked beyond 10 MiB
    const largeFile = createMockFile('huge.png', 'image/png');
    Object.defineProperty(largeFile, 'size', { value: CLIENT_MAX_IMAGE_SIZE_BYTES + 1024 });

    const attachments: AttachmentItem[] = [{ type: 'image', file: largeFile }];

    const res = await prepareMultimodalPrompt('Process large image', attachments, async () => '');
    expect(res.success).toBe(false);
    if (res.success) return;

    expect(res.error).toContain('is too large');
  });
});
