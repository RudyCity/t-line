import { Film, Image as ImageIcon, Sparkles, AlertCircle, CheckCircle2, Volume2 } from 'lucide-react';
import type { StudioQualityReport, StudioVisionReview } from '../../services/studioApi';

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
  promptHistory?: Array<{ prompt: string; response: string }>;
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

const control = 'rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function StudioQuickDirectPanel({
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
    <div className="flex flex-col bg-[var(--bg-sidebar)] text-[var(--text-main)]" aria-label="AI Studio Director Service">
      {/* Attachments chips */}
      {(promptImages.length > 0 || promptAudio) && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
          {promptImages.map((item, i) => (
            <span
              key={item.id + i}
              title={item.id}
              className="inline-flex items-center gap-1.5 rounded bg-[var(--bg-main)] px-2 py-0.5 border border-[var(--border-color)] text-[11px] text-[var(--text-muted)]"
            >
              <ImageIcon size={11} className="text-[var(--color-primary)]" />
              Image: {item.name}{promptImages.length > 1 ? ` (scene ${i + 1})` : ''}
              <button
                type="button"
                aria-label={i === 0 ? 'Remove prompt image' : `Remove prompt image ${i + 1}`}
                className="text-red-400 hover:text-red-300 font-bold ml-0.5"
                onClick={() => onRemoveImage(i)}
                disabled={busy}
              >
                ×
              </button>
            </span>
          ))}

          {promptAudio && (
            <span
              title={promptAudio.id}
              className="inline-flex items-center gap-1.5 rounded bg-[var(--bg-main)] px-2 py-0.5 border border-[var(--border-color)] text-[11px] text-[var(--text-muted)]"
            >
              <Volume2 size={11} className="text-[var(--color-primary)]" />
              WAV: {promptAudio.name} ({promptAudio.seconds.toFixed(1)}s)
              <button
                type="button"
                aria-label="Remove prompt audio"
                className="text-red-400 hover:text-red-300 font-bold ml-0.5"
                onClick={onRemoveAudio}
                disabled={busy}
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* Audio & Voiceover configurations */}
      {promptAudio && (
        <div className="flex flex-wrap items-center gap-2 p-2 border-b border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
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

      {directorVoiceoverAvailable && (
        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--bg-main)] text-[11px] space-y-1.5">
          {!selectedId && (
            <label className="inline-flex items-center gap-1.5 text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                aria-label="Automatically narrate scenes"
                checked={directorAutoNarration}
                onChange={event => onToggleAutoNarration(event.target.checked)}
                disabled={busy}
                className="accent-[var(--color-primary)]"
              />
              Generate narration from scene scripts
            </label>
          )}

          {!directorAutoNarration && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span>Voiceover script (local Piper)</span>
                <label className="inline-flex items-center gap-1">
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
              </div>
              <textarea
                className={control + ' w-full resize-y text-xs'}
                rows={2}
                maxLength={220}
                aria-label="Studio voice-over script"
                disabled={busy}
                value={promptVoiceover}
                onChange={event => onChangeVoiceover(event.target.value)}
                placeholder="Enter voiceover narration script..."
              />
            </div>
          )}
        </div>
      )}

      {/* Main Generation & Revision Form */}
      <form
        className="p-3 space-y-2 border-b border-[var(--border-color)] bg-[var(--bg-card)]"
        onSubmit={event => {
          event.preventDefault();
          onSubmitPrompt();
        }}
      >
        <label className="block text-[11px] font-medium text-[var(--text-muted)]" htmlFor="motion-director-prompt">
          {selectedId ? 'Describe a revision to this motion' : 'Describe the motion you want to create'}
        </label>
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] focus-within:border-[var(--color-primary)]/80 focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
          <textarea
            id="motion-director-prompt"
            aria-label="Studio prompt"
            className="w-full resize-none bg-transparent p-2.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none leading-relaxed"
            rows={2}
            maxLength={2000}
            value={motionPrompt}
            onChange={event => onChangePrompt(event.target.value)}
            placeholder={
              selectedId
                ? 'Ketik instruksi revisi adegan (misal: percepat animasi, ganti headline, tambah audio)...'
                : 'Ketik konsep scene video (misal: buat promo SaaS modern 15 detik, gaya minimalis)...'
            }
            disabled={busy}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (motionPrompt.trim() && !busy && directorAvailable) {
                  onSubmitPrompt();
                }
              }
            }}
          />

          <div
            className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border-color)]/50 px-2 py-1.5 bg-[var(--bg-card)] rounded-b-lg"
            aria-label="Studio prompt attachments"
          >
            <div className="flex items-center gap-1">
              {/* Attach Image */}
              <label
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
                title="Attach image assets"
              >
                <ImageIcon size={13} className="text-[var(--color-primary)]" />
                <span className="hidden sm:inline">Image</span>
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

              {/* Attach Audio */}
              <label
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
                title="Attach WAV soundtrack"
              >
                <Film size={13} className="text-[var(--color-primary)]" />
                <span className="hidden sm:inline">Audio</span>
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

              {/* Aspect Ratio */}
              {!selectedId && directorAspectAvailable && (
                <select
                  aria-label="Studio aspect ratio"
                  className="rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-1.5 py-0.5 text-[11px] text-[var(--text-main)] font-medium"
                  disabled={busy}
                  value={promptAspectRatio}
                  onChange={event => onChangeAspectRatio(event.target.value as '16:9' | '1:1' | '9:16')}
                >
                  <option value="16:9">16:9</option>
                  <option value="1:1">1:1</option>
                  <option value="9:16">9:16</option>
                </select>
              )}
            </div>

            <button
              type="submit"
              className={primary}
              disabled={busy || !motionPrompt.trim() || !directorAvailable}
            >
              <Sparkles size={12} />
              <span>{selectedId ? 'Revise with AI' : 'Generate with AI'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Capability requirements hint */}
      <p className="p-2 text-[10px] leading-relaxed text-[var(--text-muted)] border-b border-[var(--border-color)] bg-[var(--bg-main)]">
        {directorAvailable
          ? 'AI uses the configured SuperAgent model. Attach up to 3 scene images and WAV (1 MB image / 2 MB WAV); Piper narration requires a local voice model, footage/3D and AI music generation are unsupported.'
          : 'AI Studio Director needs an updated SuperAgent server with prompt support. The manual editor remains available.'}
        {!directorMediaAvailable && directorAvailable ? ' Media attachments require an updated SuperAgent server.' : ''} Select “Select a project” to start a new video.
      </p>

      {/* Recent prompt history log */}
      {promptHistory && promptHistory.length > 0 && (
        <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] space-y-2">
          {promptHistory.map((entry, index) => (
            <div key={index} className="rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2 text-xs">
              <div className="font-medium text-[var(--text-main)] leading-relaxed break-words">
                {entry.prompt}
              </div>
              {entry.response && (
                <div className="text-[11px] text-[var(--text-muted)] mt-1">
                  {entry.response}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quality Checks & Findings */}
      {quality && (
        <details className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-xs shadow-xs m-2" aria-label="Studio quality checks" open>
          <summary className="flex cursor-pointer items-center justify-between font-medium">
            <span className="flex items-center gap-1.5">
              {quality.passed ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertCircle size={13} className="text-amber-400" />}
              Quality checks · {quality.passed ? 'Structure OK' : 'Needs attention'}
              {quality.issues.length > 0 ? ` · ${quality.issues.length} finding(s)` : ' · no warnings'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">(frame sampling)</span>
          </summary>

          <div className="mt-2.5 space-y-2 border-t border-[var(--border-color)] pt-2">
            <div className="flex flex-wrap gap-1.5">
              {captionsAvailable && (
                <button type="button" className={action} onClick={onExportCaptions} disabled={busy}>
                  Export scene subtitles (.srt)
                </button>
              )}
              {visionRepairAvailable && (
                <button type="button" className={action} onClick={onRepairVision} disabled={busy}>
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
              <div className="mt-2.5 rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2.5" aria-label="Studio AI vision findings">
                <div className="font-semibold text-xs text-[var(--text-main)]">
                  {visionReview.passed ? 'Sampled frames reviewed' : 'Visual issues identified'}
                </div>
                <p className="my-1 text-[11px] text-[var(--text-muted)]">
                  Independent model opinion on frames {visionReview.reviewedFrames.join(', ')}; not a full-video guarantee.
                </p>
                {visionReview.issues.map((issue, index) => (
                  <div key={index} className="mt-2 rounded-md border border-[var(--border-color)] p-2 bg-[var(--bg-card)]">
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
              <div className="grid grid-cols-3 gap-2 mt-2" aria-label="Rendered Studio frame samples">
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
    </div>
  );
}
