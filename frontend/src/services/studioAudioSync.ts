import type { StudioAudioTrack } from './studioApi';

export interface StudioClipState {
  active: boolean;
  sourceSeconds: number;
  gain: number;
}

/** Preview the exact frame-relative clip delay and gain/fades used by the MP4 renderer. */
export function motionClipAtFrame(
  clip: StudioAudioTrack, frame: number, fps: number, clipSeconds: number, durationFrames?: number,
): StudioClipState {
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(clipSeconds) || clipSeconds <= 0) {
    return { active: false, sourceSeconds: 0, gain: 0 };
  }
  const elapsed = (frame - clip.startFrame) / fps;
  const maxSeconds = clip.loop && durationFrames !== undefined
    ? Math.max(0, (durationFrames - clip.startFrame) / fps) : clipSeconds;
  if (elapsed < 0 || elapsed >= maxSeconds) return {
    active: false, sourceSeconds: Math.max(0, Math.min(clipSeconds, elapsed)), gain: 0,
  };
  const fadeIn = Math.min(clipSeconds, (clip.fadeInFrames ?? 0) / fps);
  const fadeOut = Math.min(maxSeconds, (clip.fadeOutFrames ?? 0) / fps);
  const attack = fadeIn > 0 ? Math.min(1, elapsed / fadeIn) : 1;
  const release = fadeOut > 0 ? Math.min(1, (maxSeconds - elapsed) / fadeOut) : 1;
  return {
    active: true,
    sourceSeconds: clip.loop ? elapsed % clipSeconds : elapsed,
    gain: Math.max(0, clip.volume * Math.min(attack, release)),
  };
}

/** Keep a dedicated timeline player near the frame clock without fighting the manual WAV player. */
export function syncStudioAudioElement(
  media: HTMLAudioElement, clip: StudioAudioTrack, frame: number,
  fps: number, clipSeconds: number, playing: boolean, durationFrames?: number,
): void {
  const at = motionClipAtFrame(clip, frame, fps, clipSeconds, durationFrames);
  media.loop = clip.loop === true;
  if (!playing || !at.active) {
    if (!media.paused) media.pause();
    if (Number.isFinite(media.duration) && media.duration > 0 &&
        Math.abs(media.currentTime - at.sourceSeconds) > 0.12) {
      media.currentTime = Math.min(at.sourceSeconds, Math.max(0, media.duration - 0.01));
    }
    return;
  }
  // HTMLMediaElement.volume is limited to [0, 1]; boosted (>1) export gains remain export-only.
  media.volume = Math.min(1, at.gain);
  if (Math.abs(media.currentTime - at.sourceSeconds) > 0.15) media.currentTime = at.sourceSeconds;
  if (media.paused) {
    // Autoplay may be blocked by the host WebView. The visible source player remains operable.
    try { void media.play().catch(() => {}); } catch { /* browser restriction */ }
  }
}
