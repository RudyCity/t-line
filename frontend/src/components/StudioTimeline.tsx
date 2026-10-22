/* Hallmark · pre-emit critique: P4 H5 E5 S5 R5 V4
 * Native keyframe editor using existing T-Line design tokens.
 */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { StudioEdit, StudioEasing, StudioProject, StudioProperty } from '../services/studioApi';
import { deleteStudioKeyframe, easeStudioKeyframe, motionFrameFromPointer, moveStudioKeyframe, setStudioKeyframeValue } from '../services/studioTimelineEdits';
import { StudioGraphEditor } from './StudioGraphEditor';

type Selected = { layerId: string; property: StudioProperty; frame: number };
type Drag = Selected & { pointerId: number; previewFrame: number; revision: number; projectId: string };
interface Props {
  project: StudioProject; currentFrame: number; selectedLayer: string | null;
  busy: boolean; isActive: boolean;
  onFrame: (frame: number) => void; onLayer: (id: string) => void;
  onEdit: (edits: StudioEdit[], note: string) => void; onError: (message: string) => void;
}
const btn = 'rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-[11px] text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';
const easingNames: StudioEasing[] = ['linear', 'step', 'easeInOut', 'easeOutBack'];

export function StudioTimeline({ project, currentFrame, selectedLayer, busy, isActive, onFrame, onLayer, onEdit, onError }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [dragged, setDragged] = useState<Drag | null>(null);
  const gesture = useRef<Drag | null>(null);
  const suppressNextClick = useRef(false);
  const [frameInput, setFrameInput] = useState('');
  const frameCount = project.composition.durationFrames;
  const maxFrame = Math.max(1, frameCount - 1);
  useEffect(() => {
    setSelected(null); setDragged(null); gesture.current = null;
  }, [project.id]);
  const track = project.composition.layers.find(layer => layer.id === selected?.layerId)?.tracks.find(item => item.property === selected?.property);
  const key = track?.keyframes.find(item => item.frame === selected?.frame);

  const choose = (selection: Selected) => {
    setSelected(selection); setFrameInput(String(selection.frame));
    onFrame(selection.frame); onLayer(selection.layerId);
  };
  const errorMessage = (error: unknown) => onError(error instanceof Error ? error.message : String(error));
  const commit = (edits: StudioEdit[], note: string) => { if (edits.length && !busy && isActive) onEdit(edits, note); };
  const move = (frame: number) => {
    if (!selected || !key || busy || !isActive) return;
    try {
      const edits = moveStudioKeyframe(project, selected.layerId, selected.property, selected.frame, frame);
      commit(edits, 'Keyframe moved');
      if (edits.length) { setSelected({ ...selected, frame }); setFrameInput(String(frame)); onFrame(frame); }
    } catch (e) { errorMessage(e); }
  };
  const start = (event: ReactPointerEvent<HTMLButtonElement>, selection: Selected) => {
    if (busy || !isActive || event.button !== 0 || gesture.current) return;
    choose(selection);
    const next: Drag = { ...selection, pointerId: event.pointerId, previewFrame: selection.frame,
      revision: project.revision, projectId: project.id };
    gesture.current = next; setDragged(next);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer event */ }
    event.stopPropagation();
  };
  const dragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const value = gesture.current;
    if (!value || value.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || !bounds.width) return;
    const nextFrame = motionFrameFromPointer(event.clientX, bounds.left, bounds.width, frameCount);
    if (nextFrame !== value.previewFrame) {
      const next = { ...value, previewFrame: nextFrame };
      gesture.current = next; setDragged(next);
    }
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>, save: boolean) => {
    const value = gesture.current;
    if (!value || value.pointerId !== event.pointerId) return;
    gesture.current = null; setDragged(null);
    try { if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* best effort */ }
    if (!save || busy || !isActive || value.revision !== project.revision || value.projectId !== project.id) return;
    if (value.previewFrame !== value.frame) {
      suppressNextClick.current = true;
      try {
        const edits = moveStudioKeyframe(project, value.layerId, value.property, value.frame, value.previewFrame);
        commit(edits, 'Keyframe moved');
        if (edits.length) {
          setSelected({ layerId: value.layerId, property: value.property, frame: value.previewFrame });
          setFrameInput(String(value.previewFrame)); onFrame(value.previewFrame);
        }
      } catch (e) { errorMessage(e); }
    }
  };
  return (
    <section className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]" aria-label="Studio timeline">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2">
        <h3 className="text-xs font-semibold">Timeline <span className="font-normal text-[var(--text-muted)]">· {frameCount} frames</span></h3>
        <span className="text-[10px] text-[var(--text-muted)]">Drag diamonds to retime · select to edit easing</span>
      </div>
      <div className="max-h-[160px] overflow-y-auto px-3 py-2" aria-label="Animation tracks">
        {project.composition.layers.map(layer => (
          <div key={layer.id} className="mb-1">
            <button type="button" onClick={() => onLayer(layer.id)}
              className={'w-24 truncate text-left text-[11px] ' + (selectedLayer === layer.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]')}>
              {layer.id}
            </button>
            {layer.tracks.map(item => (
              <div key={item.property} className="flex min-h-[30px] items-center gap-2 text-[10px]">
                <span className="w-24 shrink-0 truncate pl-2 font-mono text-[var(--text-muted)]">{item.property}</span>
                <div data-timeline-lane={layer.id + '-' + item.property}
                  className="relative h-6 min-w-0 flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-card)]">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-[var(--text-main)] opacity-60"
                    style={{ left: currentFrame / maxFrame * 100 + '%' }} />
                  {item.keyframes.map(point => {
                    const chosen = selected?.layerId === layer.id && selected.property === item.property && selected.frame === point.frame;
                    const active = dragged?.layerId === layer.id && dragged.property === item.property && dragged.frame === point.frame;
                    const shown = active ? dragged.previewFrame : point.frame;
                    return (
                      <button type="button" key={point.frame}
                        aria-label={layer.id + ' ' + item.property + ' frame ' + point.frame}
                        aria-pressed={chosen} disabled={busy || !isActive}
                        title={item.property + ': ' + point.value + ' · ' + (point.easing ?? 'linear') + ' · frame ' + shown}
                        style={{ left: shown / maxFrame * 100 + '%', touchAction: 'none' }}
                        className={'absolute top-[5px] h-[12px] w-[12px] -translate-x-1/2 rotate-45 border-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)] ' +
                          (chosen ? 'border-[var(--text-main)] bg-[var(--color-primary)]' : 'border-[var(--color-primary)] bg-[var(--bg-card)]')}
                        onClick={() => {
                          if (suppressNextClick.current) { suppressNextClick.current = false; return; }
                          choose({ layerId: layer.id, property: item.property, frame: point.frame });
                        }}
                        onPointerDown={event => start(event, { layerId: layer.id, property: item.property, frame: point.frame })}
                        onPointerMove={dragging} onPointerUp={event => finish(event, true)}
                        onPointerCancel={event => finish(event, false)}
                        onLostPointerCapture={event => { if (gesture.current?.pointerId === event.pointerId) finish(event, false); }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {selected && key && (
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border-color)] px-3 py-2" aria-label="Selected keyframe editor">
          <span className="mr-auto text-[11px] text-[var(--text-muted)]">{selected.layerId} · {selected.property} · value {key.value}</span>
          <label className="grid gap-1 text-[10px] text-[var(--text-muted)]" htmlFor="motion-keyframe-frame">Frame
            <input id="motion-keyframe-frame" type="number" min={0} max={frameCount - 1} step={1}
              value={frameInput} disabled={busy || !isActive} onChange={event => setFrameInput(event.target.value)}
              className="w-20 rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[var(--text-main)]" />
          </label>
          <button type="button" className={btn}
            disabled={busy || !isActive || !frameInput.trim() || !Number.isSafeInteger(Number(frameInput))}
            onClick={() => move(Number(frameInput))}>Move</button>
          <label className="grid gap-1 text-[10px] text-[var(--text-muted)]" htmlFor="motion-keyframe-easing">Outgoing easing
            <select id="motion-keyframe-easing" value={key.easing ?? 'linear'} disabled={busy || !isActive}
              onChange={event => {
                try { commit(easeStudioKeyframe(project, selected.layerId, selected.property, selected.frame, event.target.value as StudioEasing), 'Keyframe easing updated'); }
                catch (e) { errorMessage(e); }
              }}
              className="rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-[var(--text-main)]">
              {easingNames.map(easing => <option value={easing} key={easing}>{easing}</option>)}
            </select>
          </label>
          <button type="button" className={btn} disabled={busy || !isActive}
            onClick={() => {
              try { commit(deleteStudioKeyframe(project, selected.layerId, selected.property, selected.frame), 'Keyframe deleted'); setSelected(null); }
              catch (e) { errorMessage(e); }
            }}>Delete keyframe</button>
        </div>
      )}
      {selected && key && track && (
        <StudioGraphEditor key={selected.layerId + ':' + selected.property}
          track={track} property={selected.property} selectedFrame={selected.frame}
          disabled={busy || !isActive}
          onValue={value => {
            try {
              commit(setStudioKeyframeValue(project, selected.layerId, selected.property, selected.frame, value),
                'Keyframe graph value updated');
            } catch (error) { errorMessage(error); }
          }}
        />
      )}
    </section>
  );
}
