/** Monotonic playback: derive frames from elapsed time to avoid accumulating interval drift. */
export function motionPlaybackFrame(startFrame: number, elapsedMs: number, fps: number, totalFrames: number): number {
  if (!Number.isSafeInteger(totalFrames) || totalFrames < 1 || !Number.isFinite(fps) || fps <= 0 ||
      !Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  const base = Math.max(0, Math.min(totalFrames - 1, Math.trunc(startFrame)));
  return (base + Math.floor(elapsedMs * fps / 1000)) % totalFrames;
}
