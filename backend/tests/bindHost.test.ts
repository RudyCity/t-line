import { describe, expect, it } from 'vitest';
import { resolveBackendBindHost } from '../src/bindHost';

describe('desktop backend network isolation', () => {
  it('binds loopback by default, including an empty environment override', () => {
    expect(resolveBackendBindHost({})).toBe('127.0.0.1');
    expect(resolveBackendBindHost({ TLINE_BIND_HOST: '' })).toBe('127.0.0.1');
    expect(resolveBackendBindHost({ TLINE_BIND_HOST: '127.0.0.1' })).toBe('127.0.0.1');
    expect(resolveBackendBindHost({ TLINE_BIND_HOST: '::1' })).toBe('::1');
  });
  it('fails closed if the runtime requests a network-facing bind implicitly', () => {
    expect(() => resolveBackendBindHost({ TLINE_BIND_HOST: '0.0.0.0' })).toThrow(/Refusing non-loopback/);
    expect(() => resolveBackendBindHost({ TLINE_BIND_HOST: '192.168.1.50' })).toThrow(/Refusing non-loopback/);
    expect(() => resolveBackendBindHost({ TLINE_BIND_HOST: '::' })).toThrow(/Refusing non-loopback/);
  });
  it('permits a deliberately configured remote bind', () => {
    expect(resolveBackendBindHost({ TLINE_BIND_HOST: '0.0.0.0', TLINE_ALLOW_REMOTE_BIND: '1' })).toBe('0.0.0.0');
  });
});
