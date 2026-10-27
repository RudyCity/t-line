import { useState } from 'react';
import {
  Layers3,
  Sparkles,
  Music,
  Wand2,
  LayoutTemplate,
  FolderOpen,
  Eye,
  FileText,
  Upload,
  Film,
  Volume2,
} from 'lucide-react';
import type { StudioLayer, StudioProject } from '../../services/studioApi';
import { StudioLayersSection } from './StudioLayersSection';

export type MediaBinTab = 'layers' | 'assets' | 'effects' | 'audio' | 'templates' | 'ai';

interface Props {
  workspacePath: string;
  project: StudioProject | null;
  busy: boolean;
  selectedLayer: string | null;
  onSelectLayer: (id: string) => void;
  onInsertLayer?: (kind: StudioLayer['kind']) => void;
  onImportImage?: (file?: File) => void;
  onReorderLayer?: (delta: number) => void;
  onRemoveSelectedLayer?: () => void;
  onImportAudio?: () => void;
  captionsAvailable?: boolean;
  onExportCaptions?: () => void;
  visionAvailable?: boolean;
  onReviewVision?: () => void;
  visionRepairAvailable?: boolean;
  onRepairVision?: () => void;
}

export function StudioMediaBin({
  workspacePath: _workspacePath,
  project,
  busy,
  selectedLayer,
  onSelectLayer,
  onInsertLayer,
  onImportImage,
  onReorderLayer,
  onRemoveSelectedLayer,
  onImportAudio,
  captionsAvailable = false,
  onExportCaptions,
  visionAvailable = false,
  onReviewVision,
  visionRepairAvailable = false,
  onRepairVision,
}: Props) {
  const [activeTab, setActiveTab] = useState<MediaBinTab>('layers');

  const tabs: { id: MediaBinTab; label: string; icon: typeof Layers3 }[] = [
    { id: 'layers', label: 'Layers', icon: Layers3 },
    { id: 'assets', label: 'Media', icon: FolderOpen },
    { id: 'effects', label: 'Effects', icon: Sparkles },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'ai', label: 'AI Suite', icon: Wand2 },
  ];

  const effectPresets = [
    { name: 'Fade In / Out', category: 'Transition', desc: 'Standard opacity ease-in and ease-out' },
    { name: 'Kinetic Slide', category: 'Motion', desc: 'Spring physics transform along X/Y axis' },
    { name: 'Specular Sheen', category: 'Stylize', desc: 'Sweeping chromatic highlight pass' },
    { name: 'Glitch Chromatic', category: 'Stylize', desc: 'RGB separation with subtle displacement' },
    { name: 'Audio Beat Pulse', category: 'Audio FX', desc: 'Auto-reacts layer scale to audio transients' },
    { name: 'Floating Particles', category: 'Atmosphere', desc: 'Procedural dust, stars or light bokeh' },
  ];

  const templatePresets = [
    { name: 'Product Reveal', ratio: '16:9', desc: 'Dynamic centered typography with product card' },
    { name: 'Social Story Reel', ratio: '9:16', desc: 'Full-bleed mobile format with animated captions' },
    { name: 'Lower Third Banner', ratio: '16:9', desc: 'Broadcast-style headline and subtitle bar' },
    { name: 'Kinetic Typography', ratio: '1:1', desc: 'Bold, punchy rhythm with synchronized audio cuts' },
  ];

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] text-[var(--text-main)]"
      aria-label="Studio Media Bin"
    >
      {/* Category Navigation Bar */}
      <div className="flex shrink-0 items-center border-b border-[var(--border-color)] bg-[var(--bg-main)] px-1 py-1 overflow-x-auto custom-scrollbar">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--bg-card)] text-[var(--color-primary)] font-semibold shadow-xs border border-[var(--border-color)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)]'
              }`}
            >
              <Icon size={13} className="shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bin Content Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'layers' && project && (
          <StudioLayersSection
            layers={project.composition.layers}
            selectedLayer={selectedLayer}
            onSelectLayer={onSelectLayer}
            onInsertLayer={onInsertLayer || (() => {})}
            onImportImage={onImportImage || (() => {})}
            onReorderLayer={onReorderLayer || (() => {})}
            onRemoveSelectedLayer={onRemoveSelectedLayer || (() => {})}
            busy={busy}
          />
        )}

        {activeTab === 'layers' && !project && (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
            No active project selected.
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-xs font-semibold text-[var(--text-main)]">Project Media</span>
              <button
                type="button"
                onClick={() => onImportImage?.()}
                className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]"
              >
                <Upload size={12} />
                <span>Import</span>
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Import PNG/JPEG images or PCM WAV audio tracks into your local workspace. Media items can be placed directly onto video and audio tracks in the timeline.
            </p>
          </div>
        )}

        {activeTab === 'effects' && (
          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-xs font-semibold text-[var(--text-main)]">Effects & Presets</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">{effectPresets.length} available</span>
            </div>
            <div className="space-y-1.5">
              {effectPresets.map(ef => (
                <div
                  key={ef.name}
                  className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-2 hover:border-[var(--color-primary)]/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-main)]">{ef.name}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-color)] font-mono">
                      {ef.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{ef.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-xs font-semibold text-[var(--text-main)]">Audio Tracks</span>
              <button
                type="button"
                onClick={() => onImportAudio?.()}
                className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]"
              >
                <Upload size={12} />
                <span>Import WAV</span>
              </button>
            </div>
            {project?.composition.audioTracks && project.composition.audioTracks.length > 0 ? (
              <div className="space-y-1.5">
                {project.composition.audioTracks.map((tr, idx) => (
                  <div
                    key={tr.assetId + '-' + idx}
                    className="flex items-center justify-between rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <Volume2 size={13} className="text-emerald-400" />
                      <span className="font-mono text-[11px] truncate max-w-[130px]">{tr.assetId}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      vol {Math.round(tr.volume * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)] italic">
                No soundtrack attached. Attach a PCM16 WAV file or request music generation through the Assistant.
              </p>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
              <span className="text-xs font-semibold text-[var(--text-main)]">Motion Templates</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">{templatePresets.length} formats</span>
            </div>
            <div className="space-y-1.5">
              {templatePresets.map(t => (
                <div
                  key={t.name}
                  className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-2 hover:border-[var(--color-primary)]/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-main)]">{t.name}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800 font-mono">
                      {t.ratio}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-3 space-y-4">
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3">
              <h4 className="text-xs font-semibold text-[var(--text-main)] mb-1 flex items-center gap-1.5">
                <Film size={13} className="text-cyan-400" />
                <span>Studio AI Director</span>
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Use the primary SuperAgent Assistant chat panel to issue video instructions, generate scenes, adjust pacing, or request edits.
              </p>
            </div>

            {/* AI Review & Captions */}
            <div className="space-y-2">
              {visionAvailable && (
                <button
                  type="button"
                  onClick={onReviewVision}
                  disabled={busy || !project}
                  className="w-full flex items-center justify-between rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Eye size={13} className="text-cyan-400" />
                    <span>Run Vision Inspection</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">Sampled frames</span>
                </button>
              )}

              {visionRepairAvailable && (
                <button
                  type="button"
                  onClick={onRepairVision}
                  disabled={busy || !project}
                  className="w-full flex items-center justify-between rounded border border-emerald-800/80 bg-emerald-950/20 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-950/40 transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <Wand2 size={13} className="text-emerald-400" />
                    <span>Apply Vision Repair</span>
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-mono">Auto</span>
                </button>
              )}

              {captionsAvailable && (
                <button
                  type="button"
                  onClick={onExportCaptions}
                  disabled={busy || !project}
                  className="w-full flex items-center justify-between rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={13} className="text-amber-400" />
                    <span>Export WebVTT Captions</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">.vtt</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
