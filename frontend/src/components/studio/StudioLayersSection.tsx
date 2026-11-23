import { useRef, useState } from 'react';
import { Layers3, Type, Square, Image as ImageIcon, ArrowUp, ArrowDown, Trash2, GripVertical } from 'lucide-react';
import type { StudioLayer } from '../../services/studioApi';

interface Props {
  layers: StudioLayer[];
  selectedLayer: string | null;
  onSelectLayer: (id: string) => void;
  onInsertLayer: (kind: StudioLayer['kind']) => void;
  onImportImage: (file?: File) => void;
  onReorderLayer: (delta: number) => void;
  onMoveLayer?: (layerId: string, toIndex: number) => void;
  onRemoveSelectedLayer: () => void;
  onLayerContextMenu?: (event: React.MouseEvent, layer: StudioLayer) => void;
  onBackgroundContextMenu?: (event: React.MouseEvent) => void;
  busy: boolean;
}

const action = 'inline-flex items-center gap-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';

export function StudioLayersSection({
  layers,
  selectedLayer,
  onSelectLayer,
  onInsertLayer,
  onImportImage,
  onReorderLayer,
  onMoveLayer,
  onRemoveSelectedLayer,
  onLayerContextMenu,
  onBackgroundContextMenu,
  busy,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const selectedIndex = layers.findIndex(item => item.id === selectedLayer);

  return (
    <aside className="flex flex-col h-full bg-[var(--bg-sidebar)]" aria-label="Studio layers">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-main)]">
          <Layers3 size={14} className="text-[var(--color-primary)]" />
          <span>Layers</span>
          <span className="rounded-full bg-[var(--bg-card)] px-1.5 py-0.2 font-mono text-[10px] text-[var(--text-muted)] border border-[var(--border-color)]">
            {layers.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className={action}
            aria-label="Move layer up"
            disabled={busy || selectedIndex <= 0}
            onClick={() => onReorderLayer(-1)}
            title="Move layer up"
          >
            <ArrowUp size={12} />
          </button>
          <button
            className={action}
            aria-label="Move layer down"
            disabled={busy || selectedIndex < 0 || selectedIndex >= layers.length - 1}
            onClick={() => onReorderLayer(1)}
            title="Move layer down"
          >
            <ArrowDown size={12} />
          </button>
          <button
            className={action + ' hover:text-red-400 hover:border-red-500/40'}
            aria-label="Delete selected layer"
            disabled={busy || !selectedLayer}
            onClick={onRemoveSelectedLayer}
            title="Delete layer"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-color)] p-2 bg-[var(--bg-main)]/40">
        <button
          className={action}
          disabled={busy}
          onClick={() => onInsertLayer('text')}
          aria-label="Add text layer"
          title="Add text layer"
        >
          <Type size={12} /> Text
        </button>
        <button
          className={action}
          disabled={busy}
          onClick={() => onInsertLayer('rect')}
          aria-label="Add rectangle layer"
          title="Add rectangle layer"
        >
          <Square size={12} /> Rect
        </button>
        <button
          className={action}
          disabled={busy}
          onClick={() => imageInputRef.current?.click()}
          aria-label="Import image layer"
          title="Import image layer"
        >
          <ImageIcon size={12} /> Image
        </button>
        <input
          ref={imageInputRef}
          type="file"
          hidden
          aria-label="Select Studio image"
          accept="image/png,image/jpeg,image/webp"
          onChange={event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            onImportImage(file);
          }}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto p-2 space-y-1"
        onContextMenu={e => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
            e.preventDefault();
            onBackgroundContextMenu?.(e);
          }
        }}
      >
        {layers.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            No layers yet. Add a text, rect, or image layer.
          </div>
        ) : (
          layers.map((item, index) => {
            const isSelected = item.id === selectedLayer;
            const isDragging = draggingIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={item.id}
                draggable={!busy}
                onDragStart={e => {
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                      layerId: item.id,
                      name: item.kind === 'text' ? item.text || item.id : item.id,
                      kind: item.kind === 'text' ? 'text' : item.kind === 'image' ? 'image' : 'video',
                      durationFrames: 90,
                      sourceType: 'layer',
                      index,
                    })
                  );
                  e.dataTransfer.effectAllowed = 'copyMove';
                  setDraggingIndex(index);
                }}
                onDragEnd={() => {
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggingIndex !== null && draggingIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={e => {
                  e.preventDefault();
                  const rawData = e.dataTransfer.getData('application/json');
                  if (rawData) {
                    try {
                      const data = JSON.parse(rawData);
                      if (data.sourceType === 'layer' && typeof data.index === 'number') {
                        if (data.index !== index) {
                          if (onMoveLayer) {
                            onMoveLayer(data.layerId, index);
                          } else {
                            onReorderLayer(index - data.index);
                          }
                        }
                      }
                    } catch {}
                  }
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                className={`group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-all cursor-grab active:cursor-grabbing select-none ${
                  isDragging ? 'opacity-30 border-dashed border-[var(--r-ui-color-border-standard)]' : ''
                } ${
                  isDragOver ? 'ring-2 ring-cyan-400 bg-cyan-950/60 border-cyan-400' : ''
                } ${
                  isSelected
                    ? 'bg-cyan-950/50 font-medium text-zinc-100 border border-cyan-500/40 shadow-xs'
                    : 'text-zinc-400 hover:bg-[var(--r-ui-color-surface-elevated)] hover:text-zinc-200 border border-transparent'
                }`}
                onClick={() => onSelectLayer(item.id)}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectLayer(item.id);
                  onLayerContextMenu?.(e, item);
                }}
              >
                <GripVertical size={11} className="text-zinc-600 group-hover:text-cyan-400 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                <span className={isSelected ? 'text-cyan-400' : 'text-zinc-400'}>
                  {item.kind === 'text' ? (
                    <Type size={13} />
                  ) : item.kind === 'image' ? (
                    <ImageIcon size={13} />
                  ) : (
                    <Square size={13} />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                  {item.kind === 'text' ? item.text || item.id : item.id}
                </span>
                <span className="font-mono text-[9px] opacity-60 px-1 py-0.2 rounded bg-[#161822] border border-[#2a2d3d] text-zinc-400">
                  {index + 1}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[var(--border-color)] px-3 py-2 text-[10px] text-[var(--text-muted)] bg-[var(--bg-sidebar)]">
        Select a layer, then reorder, edit, or animate it.
      </div>
    </aside>
  );
}
