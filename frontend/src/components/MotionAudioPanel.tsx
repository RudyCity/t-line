import { useEffect, useRef, useState } from 'react';
import type { MotionAudioTrack, MotionEdit, MotionProject } from '../services/motionStudioApi';
import { motionStudioApi } from '../services/motionStudioApi';

interface Props {
  project: MotionProject;
  workspacePath: string;
  busy: boolean;
  isActive: boolean;
  onUpload: (file: File) => void;
  onEdit: (edits: MotionEdit[], note: string) => void;
  onError: (message: string) => void;
}
const field = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[var(--text-main)]';
const button = 'rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';

export function MotionAudioPanel({ project, workspacePath, busy, isActive, onUpload, onEdit, onError }: Props) {
  const audio = project.composition.audio;
  const [start, setStart] = useState(String(audio?.startFrame ?? 0));
  const [volume, setVolume] = useState(String(audio?.volume ?? 1));
  const [preview, setPreview] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setStart(String(audio?.startFrame ?? 0));
    setVolume(String(audio?.volume ?? 1));
  }, [project.id, audio?.assetId, audio?.startFrame, audio?.volume]);
  useEffect(() => {
    let cancelled = false;
    let ownedUrl = '';
    setPreview('');
    if (audio) {
      void motionStudioApi.loadAudioUrl(workspacePath, audio.assetId).then(url => {
        if (cancelled) URL.revokeObjectURL?.(url);
        else { ownedUrl = url; setPreview(url); }
      }).catch(cause => {
        if (!cancelled) onError(cause instanceof Error ? cause.message : String(cause));
      });
    }
    return () => {
      cancelled = true;
      if (ownedUrl) URL.revokeObjectURL?.(ownedUrl);
    };
  }, [workspacePath, project.id, audio?.assetId]);
  const validStart = start.trim() && Number.isSafeInteger(Number(start)) &&
    Number(start) >= 0 && Number(start) < project.composition.durationFrames;
  const validVolume = volume.trim() && Number.isFinite(Number(volume)) &&
    Number(volume) >= 0 && Number(volume) <= 2;
  const pending: MotionAudioTrack | null = audio && validStart && validVolume ? {
    assetId: audio.assetId, startFrame: Number(start), volume: Number(volume),
  } : null;
  return (
    <section className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2 text-[11px]" aria-label="Motion audio track">
      <div className="flex flex-wrap items-center gap-3">
        <strong className="font-semibold">Audio · PCM16 WAV</strong>
        <button type="button" className={button} disabled={busy || !isActive} onClick={() => fileInput.current?.click()}>
          {audio ? 'Replace WAV' : 'Import WAV'}
        </button>
        <input type="file" hidden ref={fileInput} aria-label="Select Motion WAV" accept=".wav,audio/wav,audio/x-wav"
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) onUpload(file);
          }} />
        {audio ? (
          <>
            <span className="font-mono text-[var(--text-muted)]">{audio.assetId.slice(0, 18)}…</span>
            <label className="flex items-center gap-1">Start frame
              <input className={field + ' w-20'} aria-label="Audio start frame" type="number" min={0}
                max={project.composition.durationFrames - 1} step={1}
                value={start} onChange={event => setStart(event.target.value)} disabled={busy || !isActive} />
            </label>
            <label className="flex items-center gap-1">Volume
              <input className={field + ' w-20'} aria-label="Audio volume" type="number" min={0} max={2} step={0.05}
                value={volume} onChange={event => setVolume(event.target.value)} disabled={busy || !isActive} />
            </label>
            <button type="button" className={button}
              disabled={busy || !isActive || !pending ||
                (pending.startFrame === audio.startFrame && pending.volume === audio.volume)}
              onClick={() => {
                if (pending) onEdit([{ type: 'set-audio', audio: pending }], 'Audio timing updated');
              }}>Save audio</button>
            <button type="button" className={button} disabled={busy || !isActive}
              onClick={() => onEdit([{ type: 'set-audio', audio: null }], 'Audio removed')}>Remove audio</button>
            {preview ? <audio controls aria-label="Motion WAV preview" preload="none" src={preview} className="h-8 w-[190px]" /> : null}
          </>
        ) : (
          <span className="text-[var(--text-muted)]">One WAV track · up to 30 seconds, 2 MB · encoded as AAC in MP4</span>
        )}
      </div>
    </section>
  );
}
