import type { StudioEdit, StudioProject } from "./studioApi";

export type StudioReconstructionCorrectionProperty =
  "x" | "y" | "scaleX" | "scaleY" | "rotation";

const EDITABLE = new Set<StudioReconstructionCorrectionProperty>(
  ["x","y","scaleX","scaleY","rotation"]
);

/** One explicit correction is always one revision-checked Studio edit.
 * Never mutates the source project or removes unrelated keyframes.
 */
export function createStudioReconstructionCorrection(
  project: StudioProject, layerId: string, frame: number,
  property: StudioReconstructionCorrectionProperty, value: number,
): StudioEdit {
  if (!Number.isSafeInteger(frame) || frame < 0 ||
      frame >= project.composition.durationFrames) {
    throw new Error("Correction frame is outside the Studio timeline");
  }
  if (!EDITABLE.has(property) || !Number.isFinite(value))
    throw new Error("Invalid reconstruction correction value");
  const layer=project.composition.layers.find(layer=>layer.id===layerId);
  if (!layer || layer.kind!=="path" ||
      !/^reconstructed-object-[1-4]$/.test(layer.id)) {
    throw new Error("Choose a reconstructed vector object");
  }
  const range: readonly [number,number] = property === "rotation"
    ? [-180,180]
    : property === "scaleX" || property === "scaleY" ? [.25,4]
      : property === "x" ? [-project.composition.width*2,project.composition.width*3]
        : [-project.composition.height*2,project.composition.height*3];
  if (value < range[0] || value > range[1])
    throw new Error("Manual correction is outside the bounded range");

  const current=layer.tracks.find(track=>track.property===property);
  const keys=current?.keyframes.map(k=>({...k})) ?? [];
  const matched=keys.find(key=>key.frame===frame);
  if (matched) matched.value=value;
  else keys.push({frame,value,easing:"linear"});
  if (!current && frame>0) {
    const base=property === "scaleX" ? (layer.scaleX??layer.scale??1)
      : property === "scaleY" ? (layer.scaleY??layer.scale??1)
      : layer[property];
    keys.push({frame:0,value:base,easing:"linear"});
  }
  keys.sort((a,b)=>a.frame-b.frame);
  return {type:"set-track",layerId,track:{property,keyframes:keys}};
}
