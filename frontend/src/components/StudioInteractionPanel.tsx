import { useEffect, useState } from "react";
import type { StudioInteractionBinding, StudioInteractionGraph, StudioProject } from "../services/studioApi";

const inputClass = "rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs text-[var(--text-main)]";
const buttonClass = "rounded border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] disabled:opacity-50";

export interface StudioInteractionPanelProps {
  project: StudioProject;
  busy: boolean;
  onSave: (graph: StudioInteractionGraph | null) => void;
  onError: (message: string) => void;
}

/** v1 rule builder; commits a validated, revisioned graph through Studio edits. */
export function StudioInteractionPanel({ project, busy, onSave, onError }: StudioInteractionPanelProps) {
  const [event, setEvent] = useState<StudioInteractionBinding["event"]>("click");
  const [action, setAction] = useState<StudioInteractionBinding["action"]>("replay");
  const [target, setTarget] = useState("stage");
  const [progress, setProgress] = useState(0);
  const graph = project.composition.interactionGraph;
  const rules = graph?.bindings ?? [];
  const targets = project.composition.layers.filter(item =>
    item.kind === "text" || item.kind === "rect" || item.kind === "path"
  );
  useEffect(() => { setTarget("stage"); setEvent("click"); setAction("replay"); setProgress(0); }, [project.id]);

  const add = () => {
    if (rules.length >= 12) { onError("Interaction Graph is limited to 12 rules"); return; }
    const eventType = event;
    const stageOnly = eventType === "ready" || eventType === "scroll";
    const nextAction = eventType === "scroll" ? "seek" : action;
    const layerId = stageOnly || target === "stage" ? undefined : target;
    if (layerId && !targets.some(item => item.id === layerId)) {
      onError("Select an existing vector/text layer"); return;
    }
    const entry: StudioInteractionBinding = {
      id: "rule-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20),
      event: eventType,
      target: layerId ? "layer" : "stage",
      ...(layerId ? { layerId } : {}),
      action: nextAction,
      ...(nextAction === "seek" && eventType !== "scroll" ? { progress: progress / 100 } : {}),
    };
    onSave({ version: 1, bindings: [...rules, entry] });
  };

  return <section className="border-t border-[var(--border-color)] px-3 py-3" aria-label="Studio Interaction Graph">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-main)]">Interaction Graph</h3>
        <p className="text-[11px] text-[var(--text-muted)]">
          Browser-only events. Saved with the Studio project revision; independent of MP4 rendering.
        </p>
      </div>
      <span className="text-[11px] text-[var(--text-muted)]">{rules.length}/12 rules</span>
    </div>
    {rules.length > 0 && <ol className="mb-2 flex flex-col gap-1">
      {rules.map(rule => <li key={rule.id}
        className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--bg-card)] px-2 py-1.5 text-xs text-[var(--text-main)]">
        <span>{rule.event} on {rule.target === "layer" ? rule.layerId : "stage"}
          {" → "}{rule.action}{rule.progress !== undefined ? " (" + Math.round(rule.progress * 100) + "%)" : ""}</span>
        <button type="button" disabled={busy} className={buttonClass}
          onClick={() => {
            const bindings = rules.filter(item => item.id !== rule.id);
            onSave(bindings.length ? { version: 1, bindings } : null);
          }} aria-label={"Remove interaction " + rule.id}>Remove</button>
      </li>)}
    </ol>}
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-[11px] text-[var(--text-muted)]">Event
        <select aria-label="Interaction event" value={event} disabled={busy} className={"ml-1 " + inputClass}
          onChange={e => {
            const v = e.target.value as StudioInteractionBinding["event"];
            setEvent(v);
            if (v === "scroll") { setAction("seek"); setTarget("stage"); }
            if (v === "ready") setTarget("stage");
          }}>
          <option value="ready">On load</option>
          <option value="click">Click</option>
          <option value="mouseenter">Hover enter</option>
          <option value="mouseleave">Hover leave</option>
          <option value="focus">Focus</option>
          <option value="scroll">Scroll</option>
        </select>
      </label>
      <label className="text-[11px] text-[var(--text-muted)]">Target
        <select aria-label="Interaction target" disabled={busy || event === "ready" || event === "scroll"}
          className={"ml-1 " + inputClass} value={target}
          onChange={e => setTarget(e.target.value)}>
          <option value="stage">Stage</option>
          {targets.map(layer => <option key={layer.id} value={layer.id}>{layer.id}</option>)}
        </select>
      </label>
      <label className="text-[11px] text-[var(--text-muted)]">Action
        <select aria-label="Interaction action" className={"ml-1 " + inputClass}
          disabled={busy || event === "scroll"} value={event === "scroll" ? "seek" : action}
          onChange={e => setAction(e.target.value as StudioInteractionBinding["action"])}>
          <option value="replay">Replay</option>
          <option value="play">Play</option>
          <option value="pause">Pause</option>
          <option value="seek">Seek</option>
        </select>
      </label>
      {action === "seek" && event !== "scroll" && <label className="text-[11px] text-[var(--text-muted)]">
        Progress % <input type="number" min={0} max={100} step={1} className={"ml-1 w-16 " + inputClass}
          aria-label="Seek progress percent" disabled={busy} value={progress}
          onChange={e => setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
      </label>}
      <button className={buttonClass} type="button" disabled={busy || rules.length >= 12}
        onClick={add}>Add rule</button>
      {rules.length > 0 && <button className={buttonClass} type="button" disabled={busy}
        onClick={() => onSave(null)}>Clear all</button>}
    </div>
  </section>;
}
