import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Layers, Save, Trash2 } from 'lucide-react';
import type { MotionProject, MotionStackEntry, MotionStackOperation } from '../services/motionStudioApi';

const btn = 'inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';
const input = 'w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs';

interface Props {
  project: MotionProject;
  busy: boolean;
  onChange: (operation: MotionStackOperation) => void;
}

function StackItem({ item, index, total, busy, maxFrames, onChange }: {
  item: MotionStackEntry; index: number; total: number; busy: boolean; maxFrames: number;
  onChange: (operation: MotionStackOperation) => void;
}) {
  const [start, setStart] = useState(String(item.startFrame ?? 0));
  const [duration, setDuration] = useState(String(item.durationFrames ?? maxFrames));
  const [params, setParams] = useState<Record<string, string | number | boolean>>(item.params ?? {});
  useEffect(() => {
    setStart(String(item.startFrame ?? 0));
    setDuration(String(item.durationFrames ?? maxFrames));
    setParams(item.params ?? {});
  }, [item, maxFrames]);
  const startNum = Number(start), durationNum = Number(duration);
  const valid = Number.isSafeInteger(startNum) && startNum >= 0 &&
    Number.isSafeInteger(durationNum) && durationNum >= 1 &&
    startNum + durationNum <= maxFrames;
  return (
    <div className="rounded border border-[var(--border-color)] p-2" data-testid={'motion-stack-' + item.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="inline-flex items-center gap-1 text-xs">
          <input aria-label={'Enable effect ' + item.id} type="checkbox" checked={item.enabled} disabled={busy}
            onChange={event => onChange({ type: 'toggle', id: item.id, enabled: event.target.checked })} />
          <span className="font-medium">{item.effectId}</span>
        </label>
        <span className="text-[10px] text-[var(--text-muted)]">{item.targetLayerId ?? 'Entire scene'}</span>
        <div className="ml-auto flex gap-1">
          <button className={btn} type="button" aria-label={'Move effect up ' + item.id} disabled={busy || index === 0}
            onClick={() => onChange({ type: 'move', id: item.id, toIndex: index - 1 })}><ArrowUp size={12}/></button>
          <button className={btn} type="button" aria-label={'Move effect down ' + item.id} disabled={busy || index === total - 1}
            onClick={() => onChange({ type: 'move', id: item.id, toIndex: index + 1 })}><ArrowDown size={12}/></button>
          <button className={btn} type="button" aria-label={'Remove effect ' + item.id} disabled={busy}
            onClick={() => onChange({ type: 'remove', id: item.id })}><Trash2 size={12}/></button>
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[10px] text-[var(--text-muted)]">Start frame
          <input className={input} type="number" min={0} step={1}
            aria-label={'Stack start ' + item.id} value={start}
            onChange={event => setStart(event.target.value)} disabled={busy} />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">Duration
          <input className={input} type="number" min={1} step={1}
            aria-label={'Stack duration ' + item.id} value={duration}
            onChange={event => setDuration(event.target.value)} disabled={busy} />
        </label>
        {Object.entries(params).map(([key, value]) => (
          <label key={key} className="text-[10px] text-[var(--text-muted)]">{key}
            {typeof value === 'boolean' ? (
              <input aria-label={'Stack param ' + item.id + ' ' + key} className="ml-2" type="checkbox"
                checked={value} disabled={busy} onChange={event => setParams(p => ({ ...p, [key]: event.target.checked }))} />
            ) : (
              <input aria-label={'Stack param ' + item.id + ' ' + key} className={input}
                type={typeof value === 'number' ? 'number' : 'text'}
                step="any" value={value}
                disabled={busy} onChange={event => setParams(p => ({ ...p, [key]: typeof value === 'number'
                  ? Number(event.target.value) : event.target.value }))} />
            )}
          </label>
        ))}
        <button type="button" className={btn + ' self-end'} disabled={busy || !valid}
          aria-label={'Save effect settings ' + item.id}
          onClick={() => onChange({ type: 'update', id: item.id,
            changes: { startFrame: startNum, durationFrames: durationNum, params } })}>
          <Save size={12}/> Save settings
        </button>
      </div>
    </div>
  );
}

export function MotionEffectStackPanel({ project, busy, onChange }: Props) {
  const items = project.composition.effectStack ?? [];
  return (
    <details aria-label="Non-destructive Motion effect stack" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Layers size={14} /> Effect Stack
        <span className="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-normal">
          {items.length} effects
        </span>
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Reorder · Toggle · Edit · Undo
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        {!items.length && <p className="text-xs text-[var(--text-muted)]">
          Choose an effect in Effects Library and click Apply to add it here.
        </p>}
        {items.map((item, i) => <StackItem key={item.id} item={item} index={i} total={items.length}
          busy={busy} maxFrames={project.composition.durationFrames} onChange={onChange}/>)}
      </div>
    </details>
  );
}
