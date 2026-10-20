import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { motionStudioApi } from '../motionStudioApi';

describe('Motion Studio authenticated client', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'tline-only-token');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
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
  it('rejects media larger than 64 MB before downloading it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200, headers: { 'Content-Length': String(70 * 1024 * 1024) },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(motionStudioApi.loadPreview('D:/studio', 'motionjob-' + 'a'.repeat(24))).rejects.toThrow('64 MB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
