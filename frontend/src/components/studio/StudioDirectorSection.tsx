import React from 'react';
import { Film, Image as ImageIcon, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import type {
  StudioQualityReport,
  StudioVisionReview,
} from '../../services/studioApi';

interface Props {
  selectedId: string;
  busy: boolean;
  directorAvailable: boolean;
  directorMediaAvailable: boolean;
  directorSceneImagesAvailable: boolean;
  directorAudioLoopAvailable: boolean;
  directorVoiceoverAvailable: boolean;
  directorAspectAvailable: boolean;
  directorSnapshotAvailable: boolean;
  directorAutoNarration: boolean;
  onToggleAutoNarration: (val: boolean) => void;
  motionPrompt: string;
  onChangePrompt: (val: string) => void;
  onSubmitPrompt: () => void;
  promptHistory: Array<{ prompt: string; response: string }>;
  promptAspectRatio: '16:9' | '1:1' | '9:16';
  onChangeAspectRatio: (val: '16:9' | '1:1' | '9:16') => void;
  promptImages: Array<{ id: string; name: string }>;
  onAttachImages: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  promptAudio: { id: string; name: string; seconds: number } | null;
  onAttachAudio: (file?: File) => void;
  onRemoveAudio: () => void;
  promptAudioGain: number;
  onChangeAudioGain: (val: number) => void;
  promptAudioLoop: boolean;
  onToggleAudioLoop: (val: boolean) => void;
  promptVoiceover: string;
  onChangeVoiceover: (val: string) => void;
  promptVoiceoverGain: number;
  onChangeVoiceoverGain: (val: number) => void;
  quality: StudioQualityReport | null;
  captionsAvailable: boolean;
  onExportCaptions: () => void;
  visionRepairAvailable: boolean;
  onRepairVision: () => void;
  visionAvailable: boolean;
  onReviewVision: () => void;
  visionReview: StudioVisionReview | null;
  onPrepareSuggestedRevision: (text: string) => void;
  motionSnapshots: Array<{ frame: number; url: string }>;
  onLoadDirectorSnapshots: () => void;
}

const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center justify-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function StudioDirectorSection({
  selectedId,
  busy,
  directorAvailable,
  directorMediaAvailable,
  directorSceneImagesAvailable,
  directorAudioLoopAvailable,
  directorVoiceoverAvailable,
  directorAspectAvailable,
  directorSnapshotAvailable,
  directorAutoNarration,
  onToggleAutoNarration,
  motionPrompt,
  onChangePrompt,
  onSubmitPrompt,
  promptHistory,
  promptAspectRatio,
  onChangeAspectRatio,
  promptImages,
  onAttachImages,
  onRemoveImage,
  promptAudio,
  onAttachAudio,
  onRemoveAudio,
  promptAudioGain,
  onChangeAudioGain,
  promptAudioLoop,
  onToggleAudioLoop,
  promptVoiceover,
  onChangeVoiceover,
  promptVoiceoverGain,
  onChangeVoiceoverGain,
  quality,
  captionsAvailable,
  onExportCaptions,
  visionRepairAvailable,
  onRepairVision,
  visionAvailable,
  onReviewVision,
  visionReview,
  onPrepareSuggestedRevision,
  motionSnapshots,
  onLoadDirectorSnapshots,
}: Props) {
  return (
    <div className="space-y-3.5 p-3.5 text-[var(--text-main)]" aria-label="AI Studio Director">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            <Sparkles size={14} />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wide">AI Studio Director</h3>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">Prompt → Storyboard → MP4</span>
      </div>

      {promptHistory.length > 0 && (
        <div className="max-h-28 space-y-1.5 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] p-2 text-xs" aria-label="Studio prompt history">
          {promptHistory.map((entry, index) => (
            <div key={index} className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5">
              <div className="font-medium text-[var(--text-main)]">{entry.prompt}</div>
              <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{entry.response}</div>
            </div>
          ))}
        </div>
      )}

      <form
        className="space-y-2.5"
        onSubmit={event => {
          event.preventDefault();
          onSubmitPrompt();
        }}
      >
        <div>
          <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1" htmlFor="motion-director-prompt">
            {selectedId ? 'Describe a revision to this motion' : 'Describe the motion you want to create'}
          </label>
          <textarea
            id="motion-director-prompt"
            aria-label="Studio prompt"
            className={control + ' min-h-[72px] w-full resize-y text-xs leading-relaxed'}
            rows={2}
            maxLength={2000}
            value={motionPrompt}
            onChange={event => onChangePrompt(event.target.value)}
            placeholder="Buat video promosi produk 15 detik, modern, background gelap dan teks animasi..."
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {!selectedId && directorAspectAvailable ? (
            <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              Aspect ratio
              <select
                aria-label="Studio aspect ratio"
                className={control + ' w-32 py-1 text-xs'}
                disabled={busy}
                value={promptAspectRatio}
                onChange={event => onChangeAspectRatio(event.target.value as '16:9' | '1:1' | '9:16')}
              >
                <option value="16:9">Landscape 16:9</option>
                <option value="1:1">Square 1:1</option>
                <option value="9:16">Portrait 9:16</option>
              </select>
            </label>
          ) : <div />}

          <button
            className={primary}
            type="submit"
            disabled={busy || !directorAvailable || !motionPrompt.trim()}
          >
            <Film size={13} /> {busy ? 'Agent working…' : selectedId ? 'Revise with AI' : 'Generate with AI'}
          </button>
        </div>
      </form>

      <div className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5" aria-label="Studio prompt attachments">
        <div className="flex flex-wrap items-center gap-1.5">
          <label className={action + ' cursor-pointer'}>
            <ImageIcon size={12} /> Attach image(s)
            <input
              type="file"
              aria-label="Attach motion image"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              multiple={directorSceneImagesAvailable}
              disabled={busy || !directorMediaAvailable}
              onChange={event => {
                onAttachImages(event.target.files);
                event.target.value = '';
              }}
            />
          </label>

          <label className={action + ' cursor-pointer'}>
            <Film size={12} /> Attach WAV audio
            <input
              type="file"
              aria-label="Attach motion WAV"
              accept=".wav,audio/wav,audio/x-wav"
              className="sr-only"
              disabled={busy || !directorMediaAvailable}
              onChange={event => {
                onAttachAudio(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
        </div>

        {promptImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {promptImages.map((item, i) => (
              <span
                key={item.id + i}
                title={item.id}
                className="inline-flex items-center gap-1 rounded bg-[var(--bg-main)] px-2 py-0.5 border border-[var(--border-color)] text-[var(--text-muted)]"
              >
                Image: {item.name}{promptImages.length > 1 ? ` (scene ${i + 1})` : ''}
                <button
                  type="button"
                  aria-label={i === 0 ? 'Remove prompt image' : `Remove prompt image ${i + 1}`}
                  className="text-red-400 hover:text-red-300 ml-1 font-bold"
                  onClick={() => onRemoveImage(i)}
                  disabled={busy}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {promptAudio && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-color)]">
            <span title={promptAudio.id} className="rounded bg-[var(--bg-main)] px-2 py-0.5 border border-[var(--border-color)]">
              WAV: {promptAudio.name} ({promptAudio.seconds.toFixed(1)}s)
              <button
                type="button"
                aria-label="Remove prompt audio"
                className="text-red-400 hover:text-red-300 ml-1 font-bold"
                onClick={onRemoveAudio}
                disabled={busy}
              >
                ×
              </button>
            </span>

            {directorAudioLoopAvailable && (
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Loop prompt soundtrack"
                  disabled={busy}
                  checked={promptAudioLoop}
                  onChange={event => onToggleAudioLoop(event.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                Loop to end
              </label>
            )}

            <label className="inline-flex items-center gap-1">
              Gain
              <input
                type="number"
                aria-label="Prompt audio gain"
                min={0}
                max={2}
                step={0.1}
                className={control + ' w-14 py-0.5 text-center font-mono text-[10px]'}
                disabled={busy}
                value={promptAudioGain}
                onChange={event => onChangeAudioGain(Number(event.target.value))}
              />
            </label>
          </div>
        )}

        {directorVoiceoverAvailable && !selectedId && (
          <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer pt-1">
            <input
              type="checkbox"
              aria-label="Automatically narrate scenes"
              checked={directorAutoNarration}
              onChange={event => onToggleAutoNarration(event.target.checked)}
              disabled={busy}
              className="accent-[var(--color-primary)]"
            />
            Generate narration from scene scripts (local Piper required)
          </label>
        )}

        {directorVoiceoverAvailable && !directorAutoNarration && (
          <div className="space-y-1.5 pt-1 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>Narration script (local Piper)</span>
              {promptVoiceover.trim() && (
                <label className="inline-flex items-center gap-1 text-[10px]">
                  Gain
                  <input
                    type="number"
                    aria-label="Studio voice-over gain"
                    min={0}
                    max={2}
                    step={0.1}
                    className={control + ' w-12 py-0.5 text-center font-mono'}
                    disabled={busy}
                    value={promptVoiceoverGain}
                    onChange={event => onChangeVoiceoverGain(Number(event.target.value))}
                  />
                </label>
              )}
            </div>
            <textarea
              className={control + ' w-full resize-y text-xs'}
              rows={2}
              maxLength={220}
              aria-label="Studio voice-over script"
              disabled={busy}
              value={promptVoiceover}
              onChange={event => onChangeVoiceover(event.target.value)}
              placeholder="Tuliskan kalimat narasi pengisi suara (maksimal 220 karakter)"
            />
          </div>
        )}
      </div>

      {quality && (
        <details className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs" aria-label="Studio quality checks">
          <summary className="flex cursor-pointer items-center justify-between font-medium">
            <span className="flex items-center gap-1.5">
              {quality.passed ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-amber-400" />}
              Quality checks · {quality.passed ? 'Structure OK' : 'Needs attention'}
              {quality.issues.length > 0 ? ` · ${quality.issues.length} finding(s)` : ' · no warnings'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">(frame sampling)</span>
          </summary>

          <div className="mt-2.5 space-y-2 border-t border-[var(--border-color)] pt-2">
            <div className="flex flex-wrap gap-1.5">
              {captionsAvailable && (
                <button type="button" className={action} onClick={onExportCaptions} disabled={busy}>
                  Export scene subtitles (.srt)
                </button>
              )}
              {visionRepairAvailable && (
                <button
                  type="button"
                  className={action}
                  onClick={onRepairVision}
                  disabled={busy}
                  title="Explicit opt-in: up to one sampled vision review and one validated scene revision"
                >
                  Review & auto-improve once
                </button>
              )}
              {visionAvailable && (
                <button type="button" className={action} onClick={onReviewVision} disabled={busy}>
                  AI Vision Review (uses configured model)
                </button>
              )}
              {directorSnapshotAvailable && (
                <button type="button" className={action} onClick={onLoadDirectorSnapshots} disabled={busy}>
                  Review actual rendered frames
                </button>
              )}
            </div>

            {visionReview && (
              <div className="rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2.5" aria-label="Studio AI vision findings">
                <div className="font-semibold text-xs text-[var(--text-main)]">
                  {visionReview.passed ? 'Sampled frames reviewed' : 'Visual issues identified'}
                </div>
                <p className="my-1 text-[11px] text-[var(--text-muted)]">
                  Independent model opinion on frames {visionReview.reviewedFrames.join(', ')}; not a full-video guarantee.
                </p>
                {visionReview.issues.map((issue, index) => (
                  <div key={index} className="mt-2 rounded border border-[var(--border-color)] p-2 bg-[var(--bg-card)]">
                    <div className="font-medium text-amber-400 text-xs">
                      {issue.severity}: {issue.category} · frame {issue.frame}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-main)]">{issue.explanation}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">Suggested: {issue.suggestion}</p>
                    <button
                      type="button"
                      className={action + ' mt-1.5'}
                      disabled={busy}
                      onClick={() => onPrepareSuggestedRevision(
                        `Improve the current motion at frame ${issue.frame} for ${issue.category}: ${issue.suggestion.slice(0, 250)}`
                      )}
                    >
                      Prepare suggested revision
                    </button>
                  </div>
                ))}
              </div>
            )}

            {motionSnapshots.length > 0 && (
              <div className="grid grid-cols-3 gap-2" aria-label="Rendered Studio frame samples">
                {motionSnapshots.map(sample => (
                  <figure key={sample.frame} className="rounded border border-[var(--border-color)] p-1 bg-[var(--bg-main)] text-center">
                    <img
                      alt={`Rendered frame ${sample.frame}`}
                      src={sample.url}
                      className="max-h-28 w-full object-contain rounded"
                    />
                    <figcaption className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
                      Frame {sample.frame}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            <div className="text-[11px] text-[var(--text-muted)]">
              Sampled {quality.samples.length} scene midpoint(s).
              {quality.issues.length === 0 ? ' No structural/readability problems detected.' : null}
            </div>
            {quality.issues.map((issue, index) => (
              <div key={index} className="text-[11px] text-amber-400">
                {issue.severity.toUpperCase()} · {issue.code} · scene {issue.scene + 1}: {issue.message}
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
        {directorAvailable
          ? 'AI uses the configured SuperAgent model. Attach up to 3 scene images and WAV (1 MB image / 2 MB WAV); Piper narration requires a local voice model, footage/3D and AI music generation are unsupported.'
          : 'AI Studio Director needs an updated SuperAgent server with prompt support. The manual editor remains available.'}
        {!directorMediaAvailable && directorAvailable ? ' Media attachments require an updated SuperAgent server.' : ''} Select “Select a project” to start a new video.
      </p>
    </div>
  );
}
