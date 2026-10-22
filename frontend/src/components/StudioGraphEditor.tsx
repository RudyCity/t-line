import { useEffect, useMemo, useState } from 'react';
import type { StudioTrack, StudioProperty } from '../services/studioApi';
import { evaluateTrack } from '../services/studioScene';

interface Props {
  track: StudioTrack;
  property: StudioProperty;
  selectedFrame: number;
  disabled: boolean;
  onValue: (next: number) => void;
}

/** A sampled value graph of the actual Studio evaluator. The selected point
 * commits through the same revision-controlled set-track edit as the timeline.
 */
export function StudioGraphEditor({ track, property, selectedFrame, disabled, onValue }: Props) {
  const key = track.keyframes.find(k => k.frame === selectedFrame);
  const [typed, setTyped] = useState(key ? String(key.value) : '');
  useEffect(() => { setTyped(key ? String(key.value) : ''); }, [key?.value, selectedFrame]);
  const graph = useMemo(() => {
    const start = track.keyframes[0].frame, end = track.keyframes.at(-1)!.frame;
    const values = track.keyframes.map(k => k.value);
    // Include overshoot in sampled extrema; never extrapolate outside track bounds.
    const sample = Array.from({ length: 101 }, (_, i) => {
      const frame = start + (end - start) * i / 100;
      return { frame, value: evaluateTrack(track, frame) };
    });
    const min = Math.min(...values, ...sample.map(item => item.value));
    const max = Math.max(...values, ...sample.map(item => item.value));
    const pad = Math.max(.01, (max - min) * .12);
    const low = min - pad, high = max + pad;
    const px = (frame: number) => 12 + 496 * (frame - start) / Math.max(1, end - start);
    const py = (value: number) => 116 - 104 * (value - low) / (high - low);
    return {
      points: sample.map(item => px(item.frame).toFixed(2) + ',' + py(item.value).toFixed(2)).join(' '),
      ticks: track.keyframes.map(item => ({ frame: item.frame, x: px(item.frame), y: py(item.value) })),
      min: low, max: high,
    };
  }, [track]);
  const value = Number(typed);
  const valid = typed.trim().length > 0 && Number.isFinite(value) && Math.abs(value) <= 100000 &&
    (property !== 'opacity' || (value >= 0 && value <= 1));
  return (
    <div aria-label="Studio graph editor" className="border-t border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-[11px]">Graph Editor · {property}</strong>
        <span className="text-[10px] text-[var(--text-muted)]">
          Sampled motion curve · {track.keyframes.length} keyframe(s)
        </span>
      </div>
      <svg viewBox="0 0 520 128" role="img" aria-label={'Studio ' + property + ' animation curve'}
        preserveAspectRatio="none" className="h-[120px] w-full rounded border border-[var(--border-color)]">
        <line x1="12" y1="64" x2="508" y2="64" stroke="currentColor" opacity=".15"/>
        <line x1="12" y1="116" x2="508" y2="116" stroke="currentColor" opacity=".15"/>
        <polyline points={graph.points} stroke="var(--color-primary)" fill="none"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {graph.ticks.map(point => (
          <circle key={point.frame} cx={point.x} cy={point.y}
            r={point.frame === selectedFrame ? 5 : 3}
            fill={point.frame === selectedFrame ? 'var(--text-main)' : 'var(--color-primary)'}
            stroke="var(--bg-card)" strokeWidth="1.5"/>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Selected keyframe value
          <input type="number" step="any" className="w-28 rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1"
            aria-label="Selected Studio keyframe value" value={typed} disabled={disabled}
            onChange={e => setTyped(e.target.value)} />
        </label>
        <button type="button" disabled={disabled || !valid || value === key?.value}
          className="rounded border border-[var(--border-color)] px-3 py-1.5 text-xs disabled:opacity-40"
          onClick={() => onValue(value)}>Save value</button>
        <span className="text-[10px] text-[var(--text-muted)]">
          Min {graph.min.toFixed(2)} · Max {graph.max.toFixed(2)} · Changes are undoable
        </span>
      </div>
    </div>
  );
}
