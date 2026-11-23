import { ChevronDown, Save, Plus, Sliders } from 'lucide-react';
import type { StudioLayer, StudioProperty } from '../../services/studioApi';
import { evaluateLayer } from '../../services/studioScene';

interface Props {
  layer: StudioLayer | null;
  frame: number;
  draftText: string;
  onChangeDraftText: (val: string) => void;
  onSaveText: () => void;
  cornerDraft: string;
  onChangeCornerDraft: (val: string) => void;
  onSaveCornerRadius: () => void;
  propertyDraft: { field: StudioProperty; value: string };
  onChangePropertyDraft: (draft: { field: StudioProperty; value: string }) => void;
  onSaveProperty: () => void;
  onKeyframe: () => void;
  onJumpToFrame: (frame: number, property: StudioProperty, value: number | string) => void;
  onPropertyContextMenu?: (event: React.MouseEvent, property: StudioProperty, currentValue: number | string) => void;
  busy: boolean;
}

const control = 'w-full rounded-md border border-[#2a2d3d] bg-[#161822] px-2.5 py-1.5 text-xs text-zinc-100 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400';
const action = 'inline-flex items-center gap-1.5 rounded-md border border-[#2a2d3d] bg-[#1a1d28] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:bg-[#232736] hover:border-cyan-500/40 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-bold text-zinc-950 shadow-sm transition-all hover:bg-cyan-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function StudioInspectorSection({
  layer,
  frame,
  draftText,
  onChangeDraftText,
  onSaveText,
  cornerDraft,
  onChangeCornerDraft,
  onSaveCornerRadius,
  propertyDraft,
  onChangePropertyDraft,
  onSaveProperty,
  onKeyframe,
  onJumpToFrame,
  onPropertyContextMenu,
  busy,
}: Props) {
  return (
    <aside className="h-full overflow-y-auto border-t border-[#222533] bg-[#0e1017] p-3 lg:border-l lg:border-t-0 select-none custom-scrollbar" aria-label="Layer inspector">
      <div className="mb-3 flex items-center justify-between border-b border-[#222533] pb-2.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-200">
          <ChevronDown size={14} className="text-cyan-400" />
          <span>Inspector & Properties</span>
        </div>
        {layer && (
          <span className="rounded bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300 uppercase">
            {layer.kind}
          </span>
        )}
      </div>

      {!layer ? (
        <div className="py-12 text-center text-xs text-zinc-500">
          <Sliders size={26} className="mx-auto mb-2 text-zinc-600 opacity-60" />
          <p className="font-medium text-zinc-400">No layer selected</p>
          <p className="text-[11px] text-zinc-600 mt-1">Select an item on the canvas or timeline to edit properties.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Layer Header Badge */}
          <div className="rounded-lg border border-[#26293a] bg-[#141620] p-2.5 text-xs shadow-inner">
            <div className="flex items-center justify-between">
              <p className="font-mono font-bold text-zinc-100 truncate">{layer.id}</p>
              <span className="font-mono text-[10px] text-zinc-400">
                {layer.width} × {layer.height}
              </span>
            </div>
          </div>

          {layer.kind === 'text' && (
            <div className="space-y-2 rounded-lg border border-[#26293a] bg-[#141620] p-2.5">
              <label htmlFor="motion-layer-text" className="text-xs font-semibold text-zinc-200">
                Text
              </label>
              <textarea
                id="motion-layer-text"
                className={control + ' min-h-[70px] resize-y font-sans'}
                maxLength={8192}
                value={draftText}
                onChange={event => onChangeDraftText(event.target.value)}
              />
              <button
                className={action}
                disabled={busy || draftText === layer.text}
                onClick={onSaveText}
              >
                <Save size={12} className="text-cyan-400" /> <span>Save text</span>
              </button>
            </div>
          )}

          {layer.kind === 'rect' && (
            <div className="space-y-2 rounded-lg border border-[#26293a] bg-[#141620] p-2.5">
              <label className="text-xs font-semibold text-zinc-200" htmlFor="motion-corner-radius">
                Rounded corner radius
              </label>
              <input
                id="motion-corner-radius"
                aria-label="Rounded corner radius"
                className={control + ' font-mono'}
                type="number"
                min={0}
                max={Math.min(4096, layer.width / 2, layer.height / 2)}
                step={1}
                value={cornerDraft}
                disabled={busy}
                onChange={event => onChangeCornerDraft(event.target.value)}
              />
              <button
                type="button"
                className={action}
                disabled={busy || cornerDraft === String(layer.cornerRadius ?? 0)}
                onClick={onSaveCornerRadius}
              >
                <Save size={12} className="text-cyan-400" />
                <span>Save rounded corners</span>
              </button>
            </div>
          )}

          {/* Properties & Keyframing Card */}
          <div
            className="space-y-2.5 rounded-lg border border-[#26293a] bg-[#141620] p-2.5"
            onContextMenu={e => {
              e.preventDefault();
              onPropertyContextMenu?.(e, propertyDraft.field, propertyDraft.value);
            }}
          >
            <div>
              <label className="text-xs font-semibold text-zinc-200 block mb-1" htmlFor="motion-property">
                Property
              </label>
              <select
                id="motion-property"
                className={control}
                value={propertyDraft.field}
                onChange={event => {
                  const field = event.target.value as StudioProperty;
                  onChangePropertyDraft({ field, value: String(evaluateLayer(layer, frame)[field]) });
                }}
              >
                <option value="x">X position</option>
                <option value="y">Y position</option>
                <option value="opacity">Opacity</option>
                <option value="rotation">Rotation</option>
                <option value="scale">Uniform Scale</option>
                <option value="scaleX">Scale X</option>
                <option value="scaleY">Scale Y</option>
                <option value="strokeDashoffset">Stroke Dash Offset</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1 font-mono" htmlFor="motion-property-value">
                Value at frame {frame}
              </label>
              <input
                id="motion-property-value"
                className={control + ' font-mono'}
                type="number"
                step="any"
                value={propertyDraft.value}
                onChange={event => onChangePropertyDraft({ ...propertyDraft, value: event.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <button className={action} disabled={busy} onClick={onSaveProperty}>
                <Save size={12} className="text-cyan-400" /> Base
              </button>
              <button className={primary} disabled={busy} onClick={onKeyframe}>
                <Plus size={12} /> Keyframe
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-zinc-500">
              Base changes update the whole layer. Keyframes animate a property over time.
            </p>
          </div>

          {/* Animation Tracks & Diamond Keyframes */}
          <div className="space-y-2 rounded-lg border border-[#26293a] bg-[#141620] p-2.5">
            <h4 className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider font-mono">Animation Tracks</h4>
            {layer.tracks.length === 0 ? (
              <p className="text-[11px] text-zinc-500">No animated properties.</p>
            ) : (
              layer.tracks.map(track => (
                <div key={track.property} className="rounded-md border border-[#222533] bg-[#0e1017] p-2">
                  <p className="mb-1 text-[11px] font-bold text-cyan-300 font-mono">{track.property}</p>
                  <div className="flex flex-wrap gap-1">
                    {track.keyframes.map(item => (
                      <button
                        key={item.frame}
                        title={`Jump to frame ${item.frame}`}
                        onClick={() => onJumpToFrame(item.frame, track.property, item.value)}
                        className="rounded bg-[#161822] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300 hover:text-cyan-300 hover:border-cyan-500/50 border border-[#2a2d3d] transition-colors"
                      >
                        f{item.frame}: {item.value}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
