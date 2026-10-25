import { describe, expect, it } from 'vitest';
import {
  getNativeNetworkProbeJs, getNativeStorageProbeJs, isValidNetworkEntry,
  redactStorageValue, sanitizeNetworkUrl,
} from './browserDiagnostics';

describe('privacy-safe native browser diagnostics', () => {
  it('redacts cookie/auth/session keys, JWT-looking values and large values', () => {
    expect(redactStorageValue('access_token', 'very-secret')).toBe('[redacted]');
    expect(redactStorageValue('API_KEY', 'secret')).toBe('[redacted]');
    expect(redactStorageValue('theme', 'dark')).toBe('dark');
    expect(redactStorageValue('shopping_cart', 'possibly private data')).toBe('[redacted]');
    expect(redactStorageValue('theme', 'Bearer actual-credential')).toBe('[redacted]');
    expect(redactStorageValue('theme', 'x'.repeat(129))).toBe('[redacted]');
  });
  it('removes query strings, fragments and rejects unsafe schemes from network records', () => {
    expect(sanitizeNetworkUrl('/api/orders?access_token=secret#fragment', 'https://service.test'))
      .toBe('https://service.test/api/orders');
    expect(sanitizeNetworkUrl('file:///etc/passwd')).toBe('[unsupported protocol]');
  });
  it('encodes native probe tab IDs and nonces without interpolating script source', () => {
    const script = getNativeStorageProbeJs('tab";alert(1)//', 'nonce\" dangerous');
    expect(script).toContain('tline-storage-snapshot');
    expect(script).toContain(JSON.stringify('tab";alert(1)//'));
    expect(getNativeNetworkProbeJs('tab-1')).toContain('tline-network-entry');
  });
  it('rejects malformed or oversized synthetic network entries', () => {
    expect(isValidNetworkEntry({ kind: 'fetch', method: 'GET', url: 'https://a.test/',
      status: 200, durationMs: 12 })).toBe(true);
    expect(isValidNetworkEntry({ kind: 'fetch', method: 'GET', url: 'x'.repeat(301),
      status: 200, durationMs: 12 })).toBe(false);
    expect(isValidNetworkEntry({ kind: 'fetch', method: 'GET', url: 'https://a.test',
      status: '200', durationMs: 12 })).toBe(false);
  });
});
