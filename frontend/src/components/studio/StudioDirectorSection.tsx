import { Film, Image as ImageIcon, Sparkles, AlertCircle, CheckCircle2, Bot, User, Mic, Send, Volume2 } from 'lucide-react';
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

const control = 'rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const PROMPT_SUGGESTIONS = [
  { label: '🚀 SaaS Promo', prompt: 'Create a 15-second modern SaaS promo with dark background, glowing cyan accents, floating UI cards, and bold headline' },
  { label: '💻 Code Tour', prompt: 'Animate a sleek terminal code card showing an async TypeScript function with syntax highlighting and subtle pulse glow' },
  { label: '📊 Metric KPI', prompt: 'Display an animated KPI card featuring +240% MRR growth with a glowing benchmark chart and animated counter' },
  { label: '🎬 Release Reel', prompt: 'High-energy feature release announcement with kinetic typography entrance, smooth zoom transitions, and particle sparks' },
];

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
    <div className="flex h-full flex-col bg-[var(--bg-sidebar)] text-[var(--text-main)] font-sans" aria-label="AI Studio Director">
      {/* CapCut Co-Pilot Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-3.5 py-2.5 bg-[var(--bg-card)]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)] shadow-xs">
            <Sparkles size={15} />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">AI Studio Director</h3>
            <div className="flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                {selectedId ? 'Interactive Revision Mode' : 'CapCut AI Video Agent'}
              </p>
            </div>
          </div>
        </div>
        <span className="rounded-full bg-[var(--bg-main)] px-2 py-0.5 font-mono text-[9px] text-[var(--text-muted)] border border-[var(--border-color)]">
          Prompt → Storyboard → MP4
        </span>
      </div>

      {/* CapCut Chat Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3" aria-label="Studio prompt history">
        {/* Welcome Message from AI Agent */}
        <div className="flex items-start gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-[var(--color-primary)] shadow-xs mt-0.5">
            <Bot size={13} />
          </span>
          <div className="space-y-2 max-w-[90%]">
            <div className="rounded-2xl rounded-tl-xs border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-xs shadow-xs leading-relaxed">
              <p className="font-medium text-[var(--text-main)]">
                {selectedId
                  ? 'Saya siap membantu merevisi adegan video ini. Ketik instruksi perubahan (misal: ganti teks judul, percepat tempo, atau tambahkan voiceover).'
                  : 'Halo! Saya AI Video Director Anda. Deskripsikan ide video yang ingin Anda buat, atau pilih salah satu inspirasi instan di bawah ini:'}
              </p>

              {!selectedId && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Inspirasi Cepat:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_SUGGESTIONS.map(sug => (
                      <button
                        key={sug.label}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] active:scale-95 shadow-2xs"
                        onClick={() => onChangePrompt(sug.prompt)}
                        disabled={busy}
                        title={sug.prompt}
                      >
                        {sug.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Stream (User Prompts & Agent Responses) */}
        {promptHistory.map((entry, index) => (
          <div key={index} className="space-y-2.5 animate-fadeIn">
            {/* User Message Bubble */}
            <div className="flex items-start justify-end gap-2">
              <div className="max-w-[85%] rounded-2xl rounded-tr-xs border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/15 px-3 py-2 text-xs shadow-xs">
                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold text-[var(--color-primary)] mb-0.5">
                  <span>You</span>
                  <span className="font-mono text-[9px] opacity-75">Step #{index + 1}</span>
                </div>
                <div className="font-medium text-[var(--text-main)] leading-relaxed break-words">
                  {entry.prompt}
                </div>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] shadow-xs mt-0.5">
                <User size={12} />
              </span>
            </div>

            {/* AI Response Bubble */}
            <div className="flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--color-primary)] shadow-xs mt-0.5">
                <Bot size={12} />
              </span>
              <div className="max-w-[88%] rounded-2xl rounded-tl-xs border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 py-2.5 text-xs shadow-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
                  <Sparkles size={11} className="text-[var(--color-primary)]" />
                  <span>AI Video Director</span>
                </div>
                <div className="text-[11px] leading-relaxed text-[var(--text-main)] break-words">
                  {entry.response}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Live Quality Checks & Vision Findings Card */}
        {quality && (
          <details className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-xs shadow-xs" aria-label="Studio quality checks">
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
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] p-2.5" aria-label="Studio AI vision findings">
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
      </div>

      {/* Docked CapCut Chat Input Console */}
      <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)] p-3 space-y-2 shadow-lg">
        {/* Attachment chips if uploaded */}
        {(promptImages.length > 0 || promptAudio) && (
          <div className="flex flex-wrap gap-1.5 pb-1">
            {promptImages.map((item, i) => (
              <span
                key={item.id + i}
                title={item.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-main)] px-2 py-0.5 border border-[var(--border-color)] text-[11px] text-[var(--text-muted)]"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-main)] px-2 py-0.5 border border-[var(--border-color)] text-[11px] text-[var(--text-muted)]"
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

        {/* Audio gain & loop controls (rendered if audio attached) */}
        {promptAudio && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)] py-1 border-b border-[var(--border-color)]/60">
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

        {/* Voiceover options when available */}
        {directorVoiceoverAvailable && (
          <div className="space-y-1.5 p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]">
            {!selectedId && (
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
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

            {!directorAutoNarration && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Narration script (local Piper)</span>
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
                </div>
                <textarea
                  className={control + ' w-full resize-y text-xs'}
                  rows={2}
                  maxLength={220}
                  aria-label="Studio voice-over script"
                  disabled={busy}
                  value={promptVoiceover}
                  onChange={event => onChangeVoiceover(event.target.value)}
                  placeholder="Enter voiceover narration script (up to 220 characters)..."
                />
              </div>
            )}
          </div>
        )}

        {/* Chat Prompt Form */}
        <form
          className="space-y-2"
          onSubmit={event => {
            event.preventDefault();
            onSubmitPrompt();
          }}
        >
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1" htmlFor="motion-director-prompt">
              {selectedId ? 'Describe a revision to this motion' : 'Describe the motion you want to create'}
            </label>
            <div className="relative rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)] focus-within:border-[var(--color-primary)]/80 focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
              <textarea
                id="motion-director-prompt"
                aria-label="Studio prompt"
                className="w-full resize-none bg-transparent p-3 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none leading-relaxed"
                rows={2}
                maxLength={2000}
                value={motionPrompt}
                onChange={event => onChangePrompt(event.target.value)}
                placeholder={
                  selectedId
                    ? "Ketik revisi (misal: percepat animasi, ganti teks headline, atau ubah warna)..."
                    : "Ketik ide video (misal: buat teaser produk SaaS 15 detik, gaya minimalis, teks kinetik bold)..."
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

              {/* Chat Media Toolbar + Send Button Inside Bottom of Input */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border-color)]/50 px-2 py-1.5 bg-[var(--bg-card)]/50 rounded-b-xl" aria-label="Studio prompt attachments">
                <div className="flex items-center gap-1">
                  {/* Attach Image */}
                  <label className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] cursor-pointer transition-colors" title="Attach image assets">
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
                  <label className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] cursor-pointer transition-colors" title="Attach WAV soundtrack">
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

                  {/* Voiceover indicator/badge */}
                  {directorVoiceoverAvailable && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        promptVoiceover.trim()
                          ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'text-[var(--text-muted)]'
                      }`}
                      title="Voiceover narration enabled (local Piper)"
                    >
                      <Mic size={13} className="text-[var(--color-primary)]" />
                      <span className="hidden sm:inline">Voiceover</span>
                    </span>
                  )}

                  {/* Aspect Ratio */}
                  {!selectedId && directorAspectAvailable && (
                    <select
                      aria-label="Studio aspect ratio"
                      className="rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[11px] text-[var(--text-main)] font-medium focus:outline-none"
                      disabled={busy}
                      value={promptAspectRatio}
                      onChange={event => onChangeAspectRatio(event.target.value as '16:9' | '1:1' | '9:16')}
                    >
                      <option value="16:9">Landscape 16:9</option>
                      <option value="1:1">Square 1:1</option>
                      <option value="9:16">Portrait 9:16</option>
                    </select>
                  )}
                </div>

                {/* Submit Action Button */}
                <button
                  className={primary}
                  type="submit"
                  disabled={busy || !directorAvailable || !motionPrompt.trim()}
                >
                  <Send size={12} className={busy ? 'animate-pulse' : ''} />
                  <span>{busy ? 'Agent working…' : selectedId ? 'Revise with AI' : 'Generate with AI'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
          {directorAvailable
            ? 'AI uses the configured SuperAgent model. Attach up to 3 scene images and WAV (1 MB image / 2 MB WAV); Piper narration requires a local voice model, footage/3D and AI music generation are unsupported.'
            : 'AI Studio Director needs an updated SuperAgent server with prompt support. The manual editor remains available.'}
          {!directorMediaAvailable && directorAvailable ? ' Media attachments require an updated SuperAgent server.' : ''} Select “Select a project” to start a new video.
        </p>
      </div>
    </div>
  );
}
