import { useEffect, useRef, useState } from 'react';
import type { MotionAudioTrack, MotionEdit, MotionProject } from '../services/motionStudioApi';
import { motionStudioApi } from '../services/motionStudioApi';

interface Props {
  project: MotionProject; workspacePath: string; busy: boolean; isActive: boolean;
  onUpload: (file: File) => void;
  onEdit: (edits: MotionEdit[], note: string) => void;
  onError: (message: string) => void;
}
interface ClipProps {
  clip: MotionAudioTrack; index: number; durationFrames: number;
  workspacePath: string; busy: boolean; isActive: boolean;
  onSave: (clip: MotionAudioTrack) => void; onRemove: () => void;
  onError: (message: string) => void;
}
const field = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[var(--text-main)]';
const button = 'rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';
const numberInput = (value: string, min: number, max: number, whole = false) =>
  value.trim().length > 0 && Number.isFinite(Number(value)) &&
  (!whole || Number.isSafeInteger(Number(value))) && Number(value) >= min && Number(value) <= max;

function MotionAudioClip({ clip, index, durationFrames, workspacePath, busy, isActive, onSave, onRemove, onError }: ClipProps) {
  const [start, setStart] = useState(String(clip.startFrame));
  const [volume, setVolume] = useState(String(clip.volume));
  const [fadeIn, setFadeIn] = useState(String(clip.fadeInFrames ?? 0));
  const [fadeOut, setFadeOut] = useState(String(clip.fadeOutFrames ?? 0));
  const [preview, setPreview] = useState('');
  useEffect(() => {
    setStart(String(clip.startFrame)); setVolume(String(clip.volume));
    setFadeIn(String(clip.fadeInFrames ?? 0)); setFadeOut(String(clip.fadeOutFrames ?? 0));
  }, [clip.assetId, clip.startFrame, clip.volume, clip.fadeInFrames, clip.fadeOutFrames]);
  useEffect(() => {
    let cancelled = false;
    let ownedUrl = '';
    setPreview('');
    void motionStudioApi.loadAudioUrl(workspacePath, clip.assetId).then(url => {
      if (cancelled) URL.revokeObjectURL?.(url);
      else { ownedUrl = url; setPreview(url); }
    }).catch(error => { if (!cancelled) onError(error instanceof Error ? error.message : String(error)); });
    return () => {
      cancelled = true;
      if (ownedUrl) URL.revokeObjectURL?.(ownedUrl);
    };
  }, [workspacePath, clip.assetId, onError]);
  const valid = numberInput(start, 0, durationFrames - 1, true) &&
    numberInput(volume, 0, 2) && numberInput(fadeIn, 0, durationFrames, true) &&
    numberInput(fadeOut, 0, durationFrames, true);
  const next: MotionAudioTrack = {
    assetId: clip.assetId, startFrame: Number(start), volume: Number(volume),
    fadeInFrames: Number(fadeIn), fadeOutFrames: Number(fadeOut),
  };
  const changed = next.startFrame !== clip.startFrame || next.volume !== clip.volume ||
    next.fadeInFrames !== (clip.fadeInFrames ?? 0) || next.fadeOutFrames !== (clip.fadeOutFrames ?? 0);
  const suffix = index === 0 ? '' : ' ' + (index + 1);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-2"
      aria-label={'Motion audio clip ' + (index + 1)}>
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
      <button className={button} type="button" disabled={busy || !isActive || !valid || !changed}
        onClick={() => onSave(next)}>{'Save audio' + suffix}</button>
      <button className={button} type="button" disabled={busy || !isActive}
        onClick={onRemove}>{'Remove audio' + suffix}</button>
      {preview ? <audio controls aria-label={'Motion WAV preview' + suffix}
        preload="none" src={preview} className="h-8 w-[175px]" /> : null}
    </div>
  );
}

export function MotionAudioPanel({ project, workspacePath, busy, isActive, onUpload, onEdit, onError }: Props) {
  const clips = project.composition.audioTracks ??
    (project.composition.audio ? [project.composition.audio] : []);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (audioTracks: MotionAudioTrack[], note: string) =>
    onEdit([{ type: 'set-audio-tracks', audioTracks }], note);
  return (
    <section className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-[11px]"
      aria-label="Motion audio track">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <strong className="font-semibold">Audio mixer · {clips.length}/4 WAV clips</strong>
        <button type="button" className={button} disabled={busy || !isActive || clips.length >= 4}
          onClick={() => fileInput.current?.click()}>{clips.length ? 'Add WAV' : 'Import WAV'}</button>
        <input type="file" hidden ref={fileInput} aria-label="Select Motion WAV"
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
          <MotionAudioClip key={index + ':' + clip.assetId} clip={clip} index={index}
            durationFrames={project.composition.durationFrames} workspacePath={workspacePath}
            busy={busy} isActive={isActive} onError={onError}
            onSave={value => update(clips.map((existing, i) => index === i ? value : existing), 'Audio timing updated')}
            onRemove={() => update(clips.filter((_, i) => index !== i), 'Audio removed')} />
        ))}
      </div>
    </section>
  );
}
