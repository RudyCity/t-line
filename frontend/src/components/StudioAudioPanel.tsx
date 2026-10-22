import { useEffect, useRef, useState } from 'react';
import type { StudioAudioTrack, StudioEdit, StudioProject, StudioWaveform } from '../services/studioApi';
import { motionClipAtFrame, syncStudioAudioElement } from '../services/studioAudioSync';
import { studioApi } from '../services/studioApi';

interface Props {
  project: StudioProject; workspacePath: string; busy: boolean; isActive: boolean;
  onUpload: (file: File) => void;
  onEdit: (edits: StudioEdit[], note: string) => void;
  onError: (message: string) => void;
  frame?: number;
  playing?: boolean;
  onSeekFrame?: (frame: number) => void;
}
interface ClipProps {
  clip: StudioAudioTrack; index: number; durationFrames: number;
  workspacePath: string; busy: boolean; isActive: boolean;
  onSave: (clip: StudioAudioTrack) => void; onRemove: () => void;
  onError: (message: string) => void;
  frame: number; fps: number; playing: boolean; onSeekFrame?: (frame: number) => void;
}
const field = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[var(--text-main)]';
const button = 'rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';
const numberInput = (value: string, min: number, max: number, whole = false) =>
  value.trim().length > 0 && Number.isFinite(Number(value)) &&
  (!whole || Number.isSafeInteger(Number(value))) && Number(value) >= min && Number(value) <= max;

function StudioAudioClip({ clip, index, durationFrames, workspacePath, busy, isActive, onSave, onRemove, onError,
  frame, fps, playing, onSeekFrame }: ClipProps) {
  const [start, setStart] = useState(String(clip.startFrame));
  const [volume, setVolume] = useState(String(clip.volume));
  const [fadeIn, setFadeIn] = useState(String(clip.fadeInFrames ?? 0));
  const [fadeOut, setFadeOut] = useState(String(clip.fadeOutFrames ?? 0));
  const [loop, setLoop] = useState(clip.loop === true);
  const [preview, setPreview] = useState('');
  const [waveform, setWaveform] = useState<StudioWaveform | null>(null);
  const [sourceSeconds, setSourceSeconds] = useState(0);
  const syncedAudioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    setStart(String(clip.startFrame)); setVolume(String(clip.volume));
    setFadeIn(String(clip.fadeInFrames ?? 0)); setFadeOut(String(clip.fadeOutFrames ?? 0));
    setLoop(clip.loop === true);
  }, [clip.assetId, clip.startFrame, clip.volume, clip.fadeInFrames, clip.fadeOutFrames]);
  useEffect(() => {
    let cancelled = false;
    let ownedUrl = '';
    setPreview('');
    void studioApi.loadAudioUrl(workspacePath, clip.assetId).then(url => {
      if (cancelled) URL.revokeObjectURL?.(url);
      else { ownedUrl = url; setPreview(url); }
    }).catch(error => { if (!cancelled) onError(error instanceof Error ? error.message : String(error)); });
    return () => {
      cancelled = true;
      if (ownedUrl) URL.revokeObjectURL?.(ownedUrl);
    };
  }, [workspacePath, clip.assetId, onError]);
  useEffect(() => {
    let cancelled = false;
    setWaveform(null);
    void studioApi.loadAudioWaveform(workspacePath, clip.assetId).then(result => {
      if (cancelled) return;
      if (!Array.isArray(result.peaks) || result.peaks.length < 8 || result.peaks.length > 256 ||
        result.peaks.some(peak => !Number.isFinite(peak) || peak < 0 || peak > 1) ||
        !Number.isFinite(result.seconds) || result.seconds <= 0 || result.seconds > 30) {
        throw new Error('Invalid Studio waveform');
      }
      setWaveform(result);
    }).catch(error => {
      if (!cancelled) onError(error instanceof Error ? error.message : String(error));
    });
    return () => { cancelled = true; };
  }, [workspacePath, clip.assetId, onError]);
  useEffect(() => {
    const media = syncedAudioRef.current;
    if (!media || !preview) return;
    syncStudioAudioElement(media, clip, frame, fps, waveform?.seconds ?? sourceSeconds, playing && isActive);
  }, [preview, clip, frame, fps, waveform?.seconds, sourceSeconds, playing, isActive]);
  useEffect(() => () => {
    const media = syncedAudioRef.current;
    if (media && !media.paused) media.pause();
  }, []);
  const valid = numberInput(start, 0, durationFrames - 1, true) &&
    numberInput(volume, 0, 2) && numberInput(fadeIn, 0, durationFrames, true) &&
    numberInput(fadeOut, 0, durationFrames, true);
  const next: StudioAudioTrack = {
    assetId: clip.assetId, startFrame: Number(start), volume: Number(volume),
    fadeInFrames: Number(fadeIn), fadeOutFrames: Number(fadeOut),
    ...(loop ? { loop: true } : {}),
  };
  const changed = next.startFrame !== clip.startFrame || next.volume !== clip.volume ||
    next.fadeInFrames !== (clip.fadeInFrames ?? 0) || next.fadeOutFrames !== (clip.fadeOutFrames ?? 0) ||
    loop !== (clip.loop === true);
  const suffix = index === 0 ? '' : ' ' + (index + 1);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-2"
      aria-label={'Studio audio clip ' + (index + 1)}>
      <span className="text-[var(--text-muted)]">Clip {index + 1}</span>
      <span title={clip.assetId} className="font-mono text-[var(--text-muted)]">{clip.assetId.slice(0, 14)}…</span>
      <label className="flex items-center gap-1">Start
        <input className={field + ' w-16'} aria-label={'Audio start frame' + suffix} type="number"
          min={0} max={durationFrames - 1} step={1} value={start}
          onChange={event => setStart(event.target.value)} disabled={busy || !isActive} />
      </label>
      <label className="flex items-center gap-1">Gain
        <input className={field + ' w-16'} aria-label={'Audio volume' + suffix} type="number"
          min={0} max={2} step={0.05} value={volume}
          onChange={event => setVolume(event.target.value)} disabled={busy || !isActive} />
      </label>
      <label className="flex items-center gap-1">Fade in
        <input className={field + ' w-16'} aria-label={'Audio fade in frames' + suffix} type="number"
          min={0} max={durationFrames} step={1} value={fadeIn}
          onChange={event => setFadeIn(event.target.value)} disabled={busy || !isActive} />
      </label>
      <label className="flex items-center gap-1">Fade out
        <input className={field + ' w-16'} aria-label={'Audio fade out frames' + suffix} type="number"
          min={0} max={durationFrames} step={1} value={fadeOut}
          onChange={event => setFadeOut(event.target.value)} disabled={busy || !isActive} />
      </label>
      <label className="inline-flex items-center gap-1">Loop
        <input type="checkbox" aria-label={'Audio loop' + suffix}
          checked={loop} disabled={busy || !isActive} onChange={event => setLoop(event.target.checked)} />
      </label>
      <button className={button} type="button" disabled={busy || !isActive || !valid || !changed}
        onClick={() => onSave(next)}>{'Save audio' + suffix}</button>
      <button className={button} type="button" disabled={busy || !isActive}
        onClick={onRemove}>{'Remove audio' + suffix}</button>
      {waveform && (
        <button type="button" className="relative h-[42px] w-full overflow-hidden rounded border border-[var(--border-color)] bg-[var(--bg-main)]"
          aria-label={'Seek audio waveform clip ' + (index + 1)}
          disabled={!isActive || busy || !onSeekFrame}
          title="Click the waveform to scrub to a scene frame"
          onClick={event => {
            if (!onSeekFrame) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (bounds.width <= 0) return;
            const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
            onSeekFrame(Math.min(durationFrames - 1, clip.startFrame + Math.round(ratio * waveform.seconds * fps)));
          }}>
          <svg viewBox={'0 0 ' + waveform.peaks.length + ' 32'} preserveAspectRatio="none"
            role="img" aria-label={'Waveform clip ' + (index + 1)} className="h-full w-full">
            {waveform.peaks.map((peak, i) => (
              <rect key={i} x={i} y={16 - Math.max(0.8, peak * 14)} width={0.75}
                height={Math.max(1.6, peak * 28)} fill="var(--color-primary)" />
            ))}
            {(() => {
              const progress = motionClipAtFrame(clip, frame, fps, waveform.seconds, durationFrames);
              return progress.active ? <line x1={progress.sourceSeconds / waveform.seconds * waveform.peaks.length}
                y1={0} x2={progress.sourceSeconds / waveform.seconds * waveform.peaks.length} y2={32}
                stroke="var(--text-main)" strokeWidth={0.8} /> : null;
            })()}
          </svg>
        </button>
      )}
      {preview ? <>
        <audio controls aria-label={'Studio WAV preview' + suffix}
          preload="none" src={preview} className="h-8 w-[175px]" />
        <audio ref={syncedAudioRef} src={preview} preload="auto"
          aria-label={'Synchronized audio clip ' + (index + 1)}
          onLoadedMetadata={event => setSourceSeconds(event.currentTarget.duration)} />
      </> : null}
    </div>
  );
}

export function StudioAudioPanel({ project, workspacePath, busy, isActive, onUpload, onEdit, onError,
  frame = 0, playing = false, onSeekFrame }: Props) {
  const fps = project.composition.fps.numerator / project.composition.fps.denominator;
  const clips = project.composition.audioTracks ??
    (project.composition.audio ? [project.composition.audio] : []);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (audioTracks: StudioAudioTrack[], note: string) =>
    onEdit([{ type: 'set-audio-tracks', audioTracks }], note);
  return (
    <section className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-[11px]"
      aria-label="Studio audio track">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <strong className="font-semibold">Audio mixer · {clips.length}/4 WAV clips</strong>
        <button type="button" className={button} disabled={busy || !isActive || clips.length >= 4}
          onClick={() => fileInput.current?.click()}>{clips.length ? 'Add WAV' : 'Import WAV'}</button>
        <input type="file" hidden ref={fileInput} aria-label="Select Studio WAV"
          accept=".wav,audio/wav,audio/x-wav" onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) onUpload(file);
          }} />
        {clips.length === 0 && (
          <span className="text-[var(--text-muted)]">Up to four PCM16 WAV tracks · 30 seconds and 2 MB each · AAC MP4 mix</span>
        )}
      </div>
      <div className="flex max-h-[230px] flex-col gap-2 overflow-y-auto">
        {clips.map((clip, index) => (
          <StudioAudioClip key={index + ':' + clip.assetId} clip={clip} index={index}
            durationFrames={project.composition.durationFrames} workspacePath={workspacePath}
            busy={busy} isActive={isActive} onError={onError}
            frame={frame} fps={fps} playing={playing} onSeekFrame={onSeekFrame}
            onSave={value => update(clips.map((existing, i) => index === i ? value : existing), 'Audio timing updated')}
            onRemove={() => update(clips.filter((_, i) => index !== i), 'Audio removed')} />
        ))}
      </div>
    </section>
  );
}
