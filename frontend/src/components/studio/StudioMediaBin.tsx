import { useState, useRef, useMemo } from 'react';
import {
  Layers3,
  FolderOpen,
  Music,
  Upload,
  Film,
  Volume2,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import type { StudioLayer, StudioProject } from '../../services/studioApi';
import { StudioLayersSection } from './StudioLayersSection';

export type MediaBinTab = 'layers' | 'assets';

interface Props {
  workspacePath: string;
  project: StudioProject | null;
  busy: boolean;
  selectedLayer: string | null;
  onSelectLayer: (id: string) => void;
  onInsertLayer?: (kind: StudioLayer['kind']) => void;
  onImportImage?: (file: File) => void;
  onReorderLayer?: (delta: number) => void;
  onMoveLayer?: (layerId: string, toIndex: number) => void;
  onRemoveSelectedLayer?: () => void;
  onImportAudio?: (file: File) => void;
  captionsAvailable?: boolean;
  onExportCaptions?: () => void;
  visionAvailable?: boolean;
  onReviewVision?: () => void;
  visionRepairAvailable?: boolean;
  onRepairVision?: () => void;
  onLayerContextMenu?: (event: React.MouseEvent, layer: StudioLayer) => void;
  onMediaContextMenu?: (event: React.MouseEvent, item: any) => void;
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
  onMoveLayer,
  onRemoveSelectedLayer,
  onImportAudio,
  captionsAvailable: _captionsAvailable = false,
  onExportCaptions: _onExportCaptions,
  visionAvailable: _visionAvailable = false,
  onReviewVision: _onReviewVision,
  visionRepairAvailable: _visionRepairAvailable = false,
  onRepairVision: _onRepairVision,
  onLayerContextMenu,
  onMediaContextMenu,
}: Props) {
  const [activeTab, setActiveTab] = useState<MediaBinTab>('layers');
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: MediaBinTab; label: string; icon: typeof Layers3 }[] = [
    { id: 'layers', label: 'Layers', icon: Layers3 },
    { id: 'assets', label: 'Media Assets', icon: FolderOpen },
  ];

  const projectAssets = useMemo(() => {
    if (!project) return [];
    const items: Array<{
      id: string;
      name: string;
      kind: 'image' | 'video' | 'audio';
      assetId: string;
      layerId?: string;
      meta?: string;
    }> = [];

    project.composition.layers.forEach(layer => {
      if (layer.kind === 'image') {
        items.push({
          id: layer.id,
          name: (layer as any).name || `Image (${layer.assetId.slice(0, 8)})`,
          kind: 'image',
          assetId: layer.assetId,
          layerId: layer.id,
          meta: `${layer.width}×${layer.height}`,
        });
      } else if (layer.kind === 'video') {
        items.push({
          id: layer.id,
          name: (layer as any).name || `Video (${layer.assetId.slice(0, 8)})`,
          kind: 'video',
          assetId: layer.assetId,
          layerId: layer.id,
          meta: `${layer.width}×${layer.height}`,
        });
      }
    });

    const audioTracks = project.composition.audioTracks ?? (project.composition.audio ? [project.composition.audio] : []);
    audioTracks.forEach((track, idx) => {
      items.push({
        id: `audio-${idx}-${track.assetId}`,
        name: `Audio ${idx + 1} (${track.assetId.slice(0, 8)})`,
        kind: 'audio',
        assetId: track.assetId,
        meta: `Vol ${Math.round(track.volume * 100)}%`,
      });
    });

    return items;
  }, [project]);

  const filteredAssets = useMemo(() => {
    if (assetFilter === 'all') return projectAssets;
    return projectAssets.filter(item => item.kind === assetFilter);
  }, [projectAssets, assetFilter]);

  return (
    <aside
      className="flex h-full w-full flex-col border-r border-[#222533] bg-[#0e1017] text-zinc-100 select-none"
      aria-label="Studio Media Bin"
    >
      {/* Category Navigation Tabs */}
      <div className="flex shrink-0 items-center border-b border-[#222533] bg-[#11131c] px-2 py-1.5 gap-1.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={isActive}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-cyan-950/80 text-cyan-300 shadow-xs border border-cyan-500/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1d29] border border-transparent'
              }`}
            >
              <Icon size={14} className={`shrink-0 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bin Content Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0e1017]">
        {activeTab === 'layers' && project && (
          <StudioLayersSection
            layers={project.composition.layers}
            selectedLayer={selectedLayer}
            onSelectLayer={onSelectLayer}
            onInsertLayer={onInsertLayer || (() => {})}
            onImportImage={onImportImage ? ((f?: File) => { if (f) onImportImage(f); }) : (() => {})}
            onReorderLayer={onReorderLayer || (() => {})}
            onMoveLayer={onMoveLayer}
            onRemoveSelectedLayer={onRemoveSelectedLayer || (() => {})}
            onLayerContextMenu={onLayerContextMenu}
            busy={busy}
          />
        )}

        {activeTab === 'layers' && !project && (
          <div className="p-4 text-center text-xs text-zinc-500">
            No active project selected.
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="p-3 space-y-3">
            {/* Hidden file inputs */}
            <input
              type="file"
              ref={imageInputRef}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file && onImportImage) {
                  onImportImage(file);
                }
                e.target.value = '';
              }}
            />
            <input
              type="file"
              ref={audioInputRef}
              accept="audio/wav,audio/wave,audio/x-wav"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file && onImportAudio) {
                  onImportAudio(file);
                }
                e.target.value = '';
              }}
            />

            <div className="flex items-center justify-between border-b border-[#222533] pb-2">
              <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">Project Media ({projectAssets.length})</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-1 text-xs text-zinc-300 hover:bg-[#202330] hover:text-white disabled:opacity-50 transition-colors"
                >
                  <Upload size={11} className="text-cyan-400" />
                  <span>Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-[#2a2d3d] bg-[#161822] px-2 py-1 text-xs text-zinc-300 hover:bg-[#202330] hover:text-white disabled:opacity-50 transition-colors"
                >
                  <Music size={11} className="text-emerald-400" />
                  <span>Audio</span>
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 text-[10px]">
              {(['all', 'video', 'image', 'audio'] as const).map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAssetFilter(filter)}
                  className={`rounded-md px-2 py-0.5 capitalize transition-all font-medium ${
                    assetFilter === filter
                      ? 'bg-cyan-500 text-zinc-950 font-bold shadow-xs'
                      : 'bg-[#161822] text-zinc-400 hover:text-zinc-200 border border-[#2a2d3d]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Assets List */}
            {filteredAssets.length > 0 ? (
              <div className="space-y-1.5">
                {filteredAssets.map(item => (
                  <div
                    key={item.id}
                    draggable={true}
                    onDragStart={e => {
                      e.dataTransfer.setData(
                        'application/json',
                        JSON.stringify({
                          assetId: item.id,
                          name: item.name,
                          kind: item.kind,
                          durationFrames: 90,
                        })
                      );
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => {
                      if (item.layerId) {
                        onSelectLayer(item.layerId);
                      }
                    }}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (item.layerId) {
                        onSelectLayer(item.layerId);
                      }
                      onMediaContextMenu?.(e, item);
                    }}
                    className={`group flex items-center justify-between rounded-md border border-[#222533] bg-[#141620] p-2 text-xs transition-all cursor-grab active:cursor-grabbing hover:border-cyan-500/50 hover:bg-[#181b26] ${
                      item.layerId && selectedLayer === item.layerId
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400/40'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0e1017] border border-[#222533]">
                        {item.kind === 'video' && <Film size={14} className="text-cyan-400" />}
                        {item.kind === 'image' && <ImageIcon size={14} className="text-amber-400" />}
                        {item.kind === 'audio' && <Volume2 size={14} className="text-emerald-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] font-semibold text-zinc-200 truncate">
                          {item.name}
                        </p>
                        {item.meta && (
                          <p className="font-mono text-[9px] text-zinc-400">
                            {item.meta}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.layerId ? (
                        <span className="text-[9px] text-cyan-300 font-mono px-1 py-0.5 rounded bg-cyan-950/70 border border-cyan-700/60">
                          Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (item.kind === 'image' && onInsertLayer) {
                              onInsertLayer('image');
                            }
                          }}
                          className="flex items-center gap-1 rounded bg-cyan-500 px-1.5 py-0.5 text-[9px] text-zinc-950 font-bold hover:bg-cyan-400"
                        >
                          <Plus size={10} />
                          <span>Insert</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#2a2d3d] p-5 text-center bg-[#11131c]">
                <FolderOpen className="mx-auto h-6 w-6 text-zinc-600 mb-1" />
                <p className="text-xs font-semibold text-zinc-300">No media assets found</p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Click Import above to add images or audio files to this project.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
