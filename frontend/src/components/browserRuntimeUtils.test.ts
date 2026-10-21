import { describe, expect, it } from 'vitest';
import { getNativeNavigationJs, shouldPollNativeWebview } from './browserRuntimeUtils';

describe('native WebView2 navigation', () => {
  it('encodes quotes and backslashes as data without script execution', () => {
    const script = getNativeNavigationJs('https://example.com/page?q=%22%3Balert(1)%3B%22');
    expect(script).toContain('window.location.assign(');
    expect(script).not.toContain('";alert(1);"');
    expect(script).toContain('example.com');
  });
  it('accepts local preview and rejects scripting protocols', () => {
    expect(getNativeNavigationJs('http://localhost:3000/')).toContain('localhost:3000');
    expect(() => getNativeNavigationJs('javascript:alert(1)')).toThrow();
    expect(() => getNativeNavigationJs('data:text/html,test')).toThrow();
  });
  it('skips background and concurrent native polling', () => {
    expect(shouldPollNativeWebview(true,false,false)).toBe(true);
    expect(shouldPollNativeWebview(false,false,false)).toBe(false);
    expect(shouldPollNativeWebview(true,true,false)).toBe(false);
    expect(shouldPollNativeWebview(true,false,true)).toBe(false);
  });
});
