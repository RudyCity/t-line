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
  busy: boolean;
}

const control = 'w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';
const primary = 'inline-flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none';

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
  busy,
}: Props) {
  return (
    <aside className="h-full overflow-y-auto border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] p-3 lg:border-l lg:border-t-0" aria-label="Layer inspector">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-main)] border-b border-[var(--border-color)] pb-2.5">
        <ChevronDown size={14} className="text-[var(--color-primary)]" />
        <span>Inspector</span>
      </div>

      {!layer ? (
        <div className="py-8 text-center text-xs text-[var(--text-muted)]">
          <Sliders size={24} className="mx-auto mb-2 opacity-30" />
          <p>Select a layer to inspect and edit its properties.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs shadow-inner">
            <p className="font-semibold text-[var(--text-main)] truncate">{layer.id}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase text-[var(--text-muted)]">
              {layer.kind} · {layer.width} × {layer.height}
            </p>
          </div>

          {layer.kind === 'text' && (
            <div className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5">
              <label htmlFor="motion-layer-text" className="text-xs font-medium text-[var(--text-main)]">
                Text
              </label>
              <textarea
                id="motion-layer-text"
                className={control + ' min-h-[70px] resize-y'}
                maxLength={8192}
                value={draftText}
                onChange={event => onChangeDraftText(event.target.value)}
              />
              <button
                className={action}
                disabled={busy || draftText === layer.text}
                onClick={onSaveText}
              >
                <Save size={12} /> Save text
              </button>
            </div>
          )}

          {layer.kind === 'rect' && (
            <div className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5">
              <label className="text-xs font-medium text-[var(--text-main)]" htmlFor="motion-corner-radius">
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
                Save rounded corners
              </button>
            </div>
          )}

          <div className="space-y-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5">
            <div>
              <label className="text-xs font-medium text-[var(--text-main)] block mb-1" htmlFor="motion-property">
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
              <label className="text-[11px] text-[var(--text-muted)] block mb-1" htmlFor="motion-property-value">
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
                <Save size={12} /> Base
              </button>
              <button className={primary} disabled={busy} onClick={onKeyframe}>
                <Plus size={12} /> Keyframe
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
              Base changes update the whole layer. Keyframes animate a property over time.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5">
            <h4 className="text-[11px] font-semibold text-[var(--text-main)]">Animation tracks</h4>
            {layer.tracks.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)]">No animated properties.</p>
            ) : (
              layer.tracks.map(track => (
                <div key={track.property} className="rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2">
                  <p className="mb-1 text-[11px] font-medium text-[var(--text-main)]">{track.property}</p>
                  <div className="flex flex-wrap gap-1">
                    {track.keyframes.map(item => (
                      <button
                        key={item.frame}
                        title={`Jump to frame ${item.frame}`}
                        onClick={() => onJumpToFrame(item.frame, track.property, item.value)}
                        className="rounded bg-[var(--bg-card)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 border border-[var(--border-color)] transition-colors"
                      >
                        {item.frame}: {item.value}
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
