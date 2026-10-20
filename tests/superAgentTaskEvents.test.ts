import { describe, expect, it } from 'vitest';
import { validTlineStreamParams } from '../backend/src/superAgentTaskEvents';

describe('T-Line SSE relay authorization boundary', () => {
  it('requires workspace, exact bounded session and a valid optional replay event ID', () => {
    expect(validTlineStreamParams('D:/work', 'sess_abc', 'a'.repeat(16) + '.1')).toBe(true);
    expect(validTlineStreamParams('D:/work', 'sess_abc')).toBe(true);
    expect(validTlineStreamParams('', 'sess_abc')).toBe(false);
    expect(validTlineStreamParams('D:/work\nHeader: x', 'sess_abc')).toBe(false);
    expect(validTlineStreamParams('D:/work', 'bad /../ session')).toBe(false);
    expect(validTlineStreamParams('D:/work', 'sess_abc', '../bad')).toBe(false);
    expect(validTlineStreamParams('D:/work', '', undefined)).toBe(false);
  });
});
