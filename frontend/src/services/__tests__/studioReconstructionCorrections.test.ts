import { describe, expect, it } from "vitest";
import type { StudioProject } from "../studioApi";
import { createStudioReconstructionCorrection } from "../studioReconstructionCorrections";

const project: StudioProject = {
  schemaVersion:1,id:"studio-"+"a".repeat(20),workspaceRoot:"D:/studio",
  revision:2,name:"Tracked video",createdAt:"2026-10-26T00:00:00Z",
  updatedAt:"2026-10-26T00:00:00Z",
  composition:{
    width:320,height:180,background:"#000000",
    fps:{numerator:30,denominator:1},durationFrames:90,
    layers:[{
      id:"reconstructed-object-1",kind:"path",x:10,y:20,width:40,height:20,
      fill:"#ffffff",rotation:0,opacity:1,d:"M0 0 L40 0 L40 20Z",
      tracks:[{property:"x",keyframes:[
        {frame:0,value:10,easing:"step"},{frame:30,value:60,easing:"easeInOut"}]}],
    }],
  },
};
describe("revision-safe manual Video-to-Code keyframe corrections",()=>{
  it("inserts a bounded keyframe and retains untouched source tracks",()=>{
    const edit=createStudioReconstructionCorrection(project,"reconstructed-object-1",15,"x",33);
    expect(edit).toMatchObject({
      type:"set-track",layerId:"reconstructed-object-1",
      track:{property:"x",keyframes:[
        {frame:0,value:10,easing:"step"},
        {frame:15,value:33,easing:"linear"},
        {frame:30,value:60,easing:"easeInOut"},
      ]},
    });
    expect(project.composition.layers[0].tracks[0].keyframes).toHaveLength(2);
    const revised=createStudioReconstructionCorrection(project,"reconstructed-object-1",30,"x",78);
    expect(revised).toMatchObject({track:{keyframes:[
      {frame:0,value:10,easing:"step"},
      {frame:30,value:78,easing:"easeInOut"},
    ]}});
  });
  it("starts missing scale track at its original value instead of teleporting at frame zero",()=>{
    const edit=createStudioReconstructionCorrection(project,"reconstructed-object-1",25,"scaleX",1.4);
    expect(edit).toMatchObject({track:{property:"scaleX",keyframes:[
      {frame:0,value:1,easing:"linear"},{frame:25,value:1.4,easing:"linear"},
    ]}});
  });
  it("refuses invalid property, frame, value, or non-reconstructed layers",()=>{
    expect(()=>createStudioReconstructionCorrection(project,"reconstructed-object-1",90,"x",12))
      .toThrow(/outside/);
    expect(()=>createStudioReconstructionCorrection(project,"reconstructed-object-1",0,"scaleY",0))
      .toThrow(/bounded/);
    expect(()=>createStudioReconstructionCorrection(project,"reconstructed-object-1",2,"rotation",NaN))
      .toThrow(/Invalid/);
    expect(()=>createStudioReconstructionCorrection(project,"another-layer",2,"x",5))
      .toThrow(/reconstructed/);
  });
});
export { project as correctionTestProject };
