import { describe, expect, it } from 'vitest';
import { motionPlaybackFrame } from '../studioTimelineClock';
describe('Studio monotonic preview clock', () => {
  it('skips missed interval ticks without accumulating frame drift', () => {
    expect(motionPlaybackFrame(10, 100, 30, 90)).toBe(13);
    expect(motionPlaybackFrame(10, 1100, 30, 90)).toBe(43);
    expect(motionPlaybackFrame(10, 3000, 30, 90)).toBe(10);
  });
  it('preserves rational FPS and clamps invalid inputs', () => {
    expect(motionPlaybackFrame(0, 1000, 30000 / 1001, 120)).toBe(29);
    expect(motionPlaybackFrame(1, -20, 30, 120)).toBe(0);
    expect(motionPlaybackFrame(1, 10, 0, 120)).toBe(0);
  });
});
