import { useEffect, useRef, useState } from "react";
import { studioApi, type StudioProject } from "../services/studioApi";
import { evaluateLayer } from "../services/studioScene";
import {
  createStudioReconstructionCorrection,
  type StudioReconstructionCorrectionProperty,
} from "../services/studioReconstructionCorrections";

interface Props {
  workspacePath: string;
  projectId: string;
  initialFrame?: number;
  onUpdated?: (project: StudioProject, layerId: string, frame: number) => void;
}
const fields: StudioReconstructionCorrectionProperty[]=[
  "x","y","scaleX","scaleY","rotation",
];
const control="rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs text-[var(--text-main)]";
const button="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs disabled:opacity-40";

/** Opt-in post-reconstruction correction, using the existing revision-safe
 * Studio keyframe API. Does not attempt to infer hidden occluded shapes.
 */
export function StudioReconstructionCorrectionPanel({
  workspacePath, projectId, initialFrame=0, onUpdated,
}:Props) {
  const [project,setProject]=useState<StudioProject|null>(null);
  const [layerId,setLayerId]=useState("reconstructed-object-1");
  const [property,setProperty]=useState<StudioReconstructionCorrectionProperty>("x");
  const [frame,setFrame]=useState(initialFrame);
  const [value,setValue]=useState("0");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const generation=useRef(0);
  // Prevent a delayed synchronization effect from overwriting a value the
  // operator has already typed. Field/frame/object changes intentionally
  // clear this guard so the newly selected keyframe can populate the input.
  const valueDirty=useRef(false);
  const load=async()=>{
    const token=++generation.current;
    setPending(true);setError("");setNotice("");
    valueDirty.current=false;
    try {
      const latest=await studioApi.inspect(workspacePath,projectId);
      if (generation.current!==token) return;
      setProject(latest);
      if (!latest.composition.layers.some(layer=>layer.id===layerId))
        setLayerId(latest.composition.layers.find(layer=>/^reconstructed-object-[1-4]$/.test(layer.id))?.id ?? "");
      setFrame(Math.min(Math.max(0,initialFrame),latest.composition.durationFrames-1));
    } catch (cause) {
      if(generation.current===token) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {if(generation.current===token) setPending(false);}
  };
  useEffect(()=>{
    void load();
    return ()=>{generation.current++;};
    // Each project/workspace change invalidates stale inspection responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[workspacePath,projectId]);
  const layer=project?.composition.layers.find(item=>item.id===layerId);
  useEffect(()=>{
    if(!layer || valueDirty.current) return;
    setValue(String(Number(evaluateLayer(layer,frame)[property].toFixed(3))));
  },[layer,frame,property]);
  const save=async()=>{
    if(!project || !layer || pending) return;
    const current=project, selected=layerId, at=frame;
    let edit;
    try {
      if (!value.trim()) throw new Error("Enter a numeric correction value");
      edit=createStudioReconstructionCorrection(current,selected,at,property,Number(value));
    } catch(cause) {
      setError(cause instanceof Error?cause.message:String(cause));
      return;
    }
    const token=generation.current;
    setPending(true);setError("");setNotice("");
    try {
      const next=await studioApi.edit(workspacePath,current.id,current.revision,[edit]);
      if(token!==generation.current) return;
      setProject(next);
      setNotice("Correction saved at frame "+at+" · revision "+next.revision);
      onUpdated?.(next,selected,at);
    } catch(cause) {
      if(token===generation.current) {
        const message=cause instanceof Error?cause.message:String(cause);
        setError(/revision|conflict/i.test(message)
          ? "Project changed in another editor. Reload before editing; no correction was applied."
          : message);
      }
    } finally {if(token===generation.current) setPending(false);}
  };
  const eligible=project?.composition.layers.filter(
    layer=>layer.kind==="path" && /^reconstructed-object-[1-4]$/.test(layer.id))??[];
  return <details className="mt-2 max-w-[720px] rounded border border-[var(--border-color)] p-2"
    aria-label="Manual reconstruction keyframe correction">
    <summary className="cursor-pointer text-xs font-semibold">
      Manually correct tracked layer at a timeline frame
    </summary>
    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
      Correct a visible object's keyframe after reconstruction. This does not recover
      hidden pixels or automatically resolve occlusion. Saving creates a new revision.
    </p>
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="text-[11px]">Object
        <select className={control+" ml-1"} aria-label="Correction object"
          value={layerId} onChange={event=>{valueDirty.current=false;setLayerId(event.target.value);}} disabled={pending}>
          {eligible.map(item=><option key={item.id} value={item.id}>{item.id}</option>)}
        </select>
      </label>
      <label className="text-[11px]">Frame
        <input className={control+" ml-1 w-20"} aria-label="Correction frame"
          type="number" min={0} max={Math.max(0,(project?.composition.durationFrames??1)-1)}
          step={1} value={frame}
          onChange={event=>{valueDirty.current=false;setFrame(Number(event.target.value));}} disabled={pending}/>
      </label>
      <label className="text-[11px]">Property
        <select className={control+" ml-1"} aria-label="Correction property"
          value={property} onChange={event=>{valueDirty.current=false;setProperty(event.target.value as StudioReconstructionCorrectionProperty);}}
          disabled={pending}>
          {fields.map(item=><option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="text-[11px]">Value
        <input className={control+" ml-1 w-24"} aria-label="Correction value"
          type="number" step="any" value={value}
          onChange={event=>{valueDirty.current=true;setValue(event.target.value);}} disabled={pending}/>
      </label>
      <button type="button" className={button} disabled={pending||!layer||!Number.isSafeInteger(frame)}
        onClick={()=>void save()}>Save keyframe</button>
      <button type="button" className={button} disabled={pending}
        onClick={()=>void load()}>Reload project</button>
    </div>
    {project && <p className="mt-1 text-[10px] text-[var(--text-muted)]">
      Revision {project.revision} · {eligible.length} editable tracked object(s)
    </p>}
    {error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
    {notice && <p role="status" className="mt-1 text-xs text-[var(--text-main)]">{notice}</p>}
  </details>;
}
