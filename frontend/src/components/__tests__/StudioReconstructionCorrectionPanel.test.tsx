import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioReconstructionCorrectionPanel } from "../StudioReconstructionCorrectionPanel";
import { studioApi, type StudioProject } from "../../services/studioApi";

const baseline: StudioProject = {
  schemaVersion:1,id:"studio-"+"a".repeat(20),workspaceRoot:"D:/studio",
  revision:2,name:"Tracked clip",createdAt:"2026-10-26T00:00:00Z",
  updatedAt:"2026-10-26T00:00:00Z",
  composition:{width:320,height:180,durationFrames:90,background:"#151515",
    fps:{numerator:30,denominator:1},layers:[{
      id:"reconstructed-object-1",kind:"path",x:10,y:20,width:40,height:20,
      fill:"#ffffff",rotation:0,opacity:1,d:"M0 0 L40 0 L40 20Z",
      tracks:[{property:"x",keyframes:[
        {frame:0,value:10,easing:"linear"},{frame:60,value:50,easing:"linear"}]}],
    }]},
};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe("Studio P7 manual video layer correction",()=>{
  it("edits selected keyframe through the authenticated revision-checked API",async()=>{
    const inspect=vi.spyOn(studioApi,"inspect").mockResolvedValue(baseline);
    const next={...baseline,revision:3};
    const edit=vi.spyOn(studioApi,"edit").mockResolvedValue(next);
    const onUpdated=vi.fn();
    render(<StudioReconstructionCorrectionPanel workspacePath="D:/studio"
      projectId={baseline.id} initialFrame={30} onUpdated={onUpdated}/>);
    await screen.findByText(/Revision 2/);
    fireEvent.click(screen.getByText(/Manually correct tracked layer/));
    fireEvent.change(screen.getByLabelText("Correction value"),{target:{value:"35"}});
    fireEvent.click(screen.getByRole("button",{name:"Save keyframe"}));
    await waitFor(()=>expect(edit).toHaveBeenCalledTimes(1));
    expect(edit).toHaveBeenCalledWith("D:/studio",baseline.id,2,[{
      type:"set-track",layerId:"reconstructed-object-1",track:{
        property:"x",keyframes:[
          {frame:0,value:10,easing:"linear"},
          {frame:30,value:35,easing:"linear"},
          {frame:60,value:50,easing:"linear"},
        ],
      },
    }]);
    await waitFor(()=>expect(onUpdated).toHaveBeenCalledWith(next,"reconstructed-object-1",30));
    expect(screen.getByText(/Correction saved at frame 30/)).toBeInTheDocument();
    expect(inspect).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite a concurrent editor on revision conflict",async()=>{
    const inspect=vi.spyOn(studioApi,"inspect").mockResolvedValue(baseline);
    const edit=vi.spyOn(studioApi,"edit").mockRejectedValue(new Error("Revision conflict"));
    render(<StudioReconstructionCorrectionPanel workspacePath="D:/studio"
      projectId={baseline.id}/>);
    await screen.findByText(/Revision 2/);
    fireEvent.click(screen.getByText(/Manually correct tracked layer/));
    fireEvent.change(screen.getByLabelText("Correction value"),{target:{value:"45"}});
    fireEvent.click(screen.getByRole("button",{name:"Save keyframe"}));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Reload before editing/);
    fireEvent.click(screen.getByRole("button",{name:"Reload project"}));
    await waitFor(()=>expect(inspect).toHaveBeenCalledTimes(2));
    expect(edit).toHaveBeenCalledTimes(1);
  });
});
