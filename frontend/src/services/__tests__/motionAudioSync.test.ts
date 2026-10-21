import { describe, expect, it, vi } from 'vitest';
import { motionClipAtFrame, syncMotionAudioElement } from '../motionAudioSync';

const clip = { assetId: 'audio-' + 'a'.repeat(64), startFrame: 15, volume: 0.8,
  fadeInFrames: 6, fadeOutFrames: 9 };
describe('Motion frame-anchored source preview', () => {
  it('applies scene offset and clip-local fades at 30 fps', () => {
    expect(motionClipAtFrame(clip, 14, 30, 1)).toMatchObject({ active: false, gain: 0 });
    expect(motionClipAtFrame(clip, 15, 30, 1)).toMatchObject({ active: true, sourceSeconds: 0, gain: 0 });
    expect(motionClipAtFrame(clip, 18, 30, 1).gain).toBeCloseTo(0.4);
    expect(motionClipAtFrame(clip, 24, 30, 1).gain).toBeCloseTo(0.8);
    expect(motionClipAtFrame(clip, 42, 30, 1).gain).toBeCloseTo(0.8 / 0.3 * 0.1);
    expect(motionClipAtFrame(clip, 45, 30, 1).active).toBe(false);
  });
  it('loops a short WAV in scene preview, with fade-out near video end', () => {
    const looping = { ...clip, loop: true };
    expect(motionClipAtFrame(looping, 75, 30, 1, 150)).toMatchObject({
      active: true, sourceSeconds: 0,
    });
    expect(motionClipAtFrame(looping, 130, 30, 1, 150).gain).toBeCloseTo(0.8);
    expect(motionClipAtFrame(looping, 148, 30, 1, 150).gain).toBeLessThan(0.8);
    expect(motionClipAtFrame(looping, 150, 30, 1, 150).active).toBe(false);
    const player = { paused: false, duration: 1, currentTime: 0, volume: 1,
      play: vi.fn(), pause: vi.fn() } as unknown as HTMLAudioElement;
    syncMotionAudioElement(player, looping, 75, 30, 1, true, 150);
    expect(player.loop).toBe(true);
  });
  it('ignores invalid fps and clips with no duration', () => {
    expect(motionClipAtFrame(clip, 20, 0, 1).active).toBe(false);
    expect(motionClipAtFrame(clip, 20, 30, Number.NaN).active).toBe(false);
  });
  it('seeks active tracks, pauses outside the window, and never alters scene data', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const player = { paused: true, duration: 1, currentTime: 0, volume: 1, play, pause } as unknown as HTMLAudioElement;
    syncMotionAudioElement(player, clip, 24, 30, 1, true);
    expect(player.currentTime).toBeCloseTo(0.3);
    expect(player.volume).toBeCloseTo(0.8);
    expect(play).toHaveBeenCalledTimes(1);
    syncMotionAudioElement({ ...player, paused: false } as HTMLAudioElement, clip, 45, 30, 1, true);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(clip.startFrame).toBe(15);
  });
  it('clamps browser preview gain to 1 while allowing export gain up to 2', () => {
    const boosted = { ...clip, volume: 2, fadeInFrames: 0, fadeOutFrames: 0 };
    expect(motionClipAtFrame(boosted, 20, 30, 1).gain).toBe(2);
    const player = { paused: false, duration: 1, currentTime: 0, volume: 0, play: vi.fn(), pause: vi.fn() } as unknown as HTMLAudioElement;
    syncMotionAudioElement(player, boosted, 20, 30, 1, true);
    expect(player.volume).toBe(1);
  });
});
