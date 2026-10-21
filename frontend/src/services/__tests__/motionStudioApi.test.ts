import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { motionStudioApi } from '../motionStudioApi';

describe('Motion Studio authenticated client', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'tline-only-token');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.removeItem('token');
  });
  it('passes T-Line auth with workspace routing and no secret in URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(motionStudioApi.list('D:/my workspace')).resolves.toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('workspace=D%3A%2Fmy%20workspace');
    expect(url).not.toContain('tline-only-token');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
  });
  it('sends prompt and revision through authorized T-Line routes, not arbitrary URLs', async () => {
    const motionId = 'motion-' + 'a'.repeat(20);
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ project: { id: motionId } }), {
      status: 202, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await motionStudioApi.quality('D:/studio', motionId);
    await motionStudioApi.generate('D:/studio', 'Buat video promo', 640);
    await motionStudioApi.revise('D:/studio', motionId, 'Bikin transisinya lebih cepat', 1280);
    expect(fetchMock.mock.calls[0][0]).toContain('/projects/' + motionId + '/quality?workspace=');
    expect(fetchMock.mock.calls[1][0]).toContain('/generate?workspace=');
    expect(fetchMock.mock.calls[2][0]).toContain('/projects/' + motionId + '/revise?workspace=');
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toMatchObject({
      prompt: 'Buat video promo', width: 640,
    });
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer tline-only-token',
    });
    expect(() => motionStudioApi.revise('D:/studio', '../secret', 'change')).toThrow('Invalid Motion');
    expect(() => motionStudioApi.quality('D:/studio', '../secret')).toThrow('Invalid Motion');
  });

  it('rejects media larger than 64 MB before downloading it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200, headers: { 'Content-Length': String(70 * 1024 * 1024) },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(motionStudioApi.loadPreview('D:/studio', 'motionjob-' + 'a'.repeat(24))).rejects.toThrow('64 MB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('uploads bounded image data with T-Line authorization and downloads authenticated Blob previews', async () => {
    const assetId = 'asset-' + 'b'.repeat(64);
    const payload = new Uint8Array(40).fill(123);
    const file = new File([payload], 'image.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => payload.buffer });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: assetId, width: 10, height: 4, bytes: 40 }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(payload, {
        status: 200, headers: { 'Content-Type': 'image/png' },
      }));
    const objectUrl = vi.fn().mockReturnValue('blob:motion-test');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(objectUrl);
    await expect(motionStudioApi.uploadImage('D:/studio', file)).resolves.toMatchObject({ id: assetId });
    const [uploadPath, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadPath).toContain('/assets?workspace=');
    expect(uploadInit.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(JSON.parse(uploadInit.body as string).base64).toBe(btoa(String.fromCharCode(...payload)));
    expect(await motionStudioApi.loadImageUrl('D:/studio', assetId)).toBe('blob:motion-test');
    expect(objectUrl).toHaveBeenCalledTimes(1);
    await expect(motionStudioApi.loadImageUrl('D:/studio', '../../secret')).rejects.toThrow('Invalid Motion asset');
  });

  it('authorizes bounded WAV uploads and authenticated audio Blob responses', async () => {
    const audioId = 'audio-' + 'd'.repeat(64);
    const payload = new Uint8Array(64).fill(100);
    const file = new File([payload], 'beat.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => payload.buffer });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: audioId, seconds: 1, bytes: 64 }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(payload, {
        status: 200, headers: { 'Content-Type': 'audio/wav' },
      }));
    const objectUrl = vi.fn().mockReturnValue('blob:audio-test');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(objectUrl);
    await expect(motionStudioApi.uploadAudio('D:/studio', file)).resolves.toMatchObject({ id: audioId });
    const [uploadPath, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadPath).toContain('/audio?workspace=');
    expect(uploadInit.headers).toMatchObject({ Authorization: 'Bearer tline-only-token' });
    expect(await motionStudioApi.loadAudioUrl('D:/studio', audioId)).toBe('blob:audio-test');
    await expect(motionStudioApi.loadAudioUrl('D:/studio', '../secret')).rejects.toThrow('Invalid Motion audio');
  });

  it('requires login and rejects invalid scene identifiers before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.removeItem('token');
    await expect(motionStudioApi.list('D:/studio')).rejects.toThrow('Sign in');
    expect(() => motionStudioApi.inspect('D:/studio', '../escape')).toThrow('Invalid Motion');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
