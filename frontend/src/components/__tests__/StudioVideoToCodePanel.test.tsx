import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioVideoToCodePanel } from "../StudioVideoToCodePanel";
import { studioApi, type StudioMultiVideoReconstruction } from "../../services/studioApi";

const result: StudioMultiVideoReconstruction = {
  status: "experimental-multi",
  projectId: "studio-" + "a".repeat(20),
  revision: 2,
  objects: [
    { id: "reconstructed-object-1", boxes: [], matchingCosts: [0.08, 0.08] },
    { id: "reconstructed-object-2", boxes: [], matchingCosts: [0.06, 0.06] },
  ],
  sampleTimes: [0, 1.5, 2.55],
  dimensions: { width: 320, height: 180 },
  confidence: .68,
  measuredForegroundIoU: [.92, .91, .90],
  interpolationCheckIoU: [.84, .82],
  parityReport: [
    {frame:0,sampleType:"keyframe",foregroundIoU:.92,foregroundPrecision:.94,
      foregroundRecall:.96,foregroundF1:.95,rgbMeanAbsoluteError:.025,foregroundRgbMeanAbsoluteError:.08},
    {frame:24,sampleType:"holdout",foregroundIoU:.84,foregroundPrecision:.90,
      foregroundRecall:.92,foregroundF1:.91,rgbMeanAbsoluteError:.042,foregroundRgbMeanAbsoluteError:.1},
    {frame:45,sampleType:"keyframe",foregroundIoU:.91,foregroundPrecision:.94,
      foregroundRecall:.95,foregroundF1:.945,rgbMeanAbsoluteError:.027,foregroundRgbMeanAbsoluteError:.08},
    {frame:60,sampleType:"holdout",foregroundIoU:.82,foregroundPrecision:.88,
      foregroundRecall:.92,foregroundF1:.90,rgbMeanAbsoluteError:.05,foregroundRgbMeanAbsoluteError:.11},
    {frame:85,sampleType:"keyframe",foregroundIoU:.9,foregroundPrecision:.93,
      foregroundRecall:.94,foregroundF1:.935,rgbMeanAbsoluteError:.03,foregroundRgbMeanAbsoluteError:.08},
  ],
  limitations: ["Only isolated 2D shapes"],
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Studio Video-to-Code experimental panel", () => {
  it("uploads, reconstructs, selects the created project and shows scoped preview", async () => {
    const importVideo = vi.spyOn(studioApi, "uploadVideo").mockResolvedValue({
      id: "video-" + "b".repeat(64), bytes: 80, format: "mp4",
    });
    const reconstruct = vi.spyOn(studioApi, "reconstructMultiVideo").mockResolvedValue(result);
    const preview = vi.spyOn(studioApi, "loadMultiVideoReviewUrl").mockResolvedValue("blob:local-review");
    const diffPreview = vi.spyOn(studioApi, "loadMultiVideoDiffUrl").mockResolvedValue("blob:local-diff");
    const revoke = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true });
    const created = vi.fn();
    const { unmount } = render(<StudioVideoToCodePanel workspacePath="D:/demo" onCreated={created} />);
    const file = new File([new Uint8Array(80)], "example.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Video reference file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Create editable layers" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith(result));
    expect(importVideo).toHaveBeenCalledWith("D:/demo", file);
    expect(reconstruct).toHaveBeenCalledWith("D:/demo", "video-" + "b".repeat(64));
    await waitFor(() => expect(preview).toHaveBeenCalledWith("D:/demo", result.projectId, 2));
    await waitFor(() => expect(diffPreview).toHaveBeenCalledWith("D:/demo", result.projectId, 2));
    expect(screen.getByRole("img", { name: /original video on the left/ })).toHaveAttribute(
      "src", "blob:local-review");
    expect(screen.getByText("Show mask difference heatmap")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Mask difference heatmap/ })).toHaveAttribute(
      "src", "blob:local-diff");
    expect(screen.getAllByText(/92.0%/).length).toBeGreaterThan(0);
    expect(screen.getByText(/unseen-frame checks: 84.0% \/ 82.0%/)).toBeInTheDocument();
    expect(screen.getByText(/Visual parity · 5 checked frames/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Video source versus reconstructed frames" });
    expect(table).toBeInTheDocument();
    expect(screen.getAllByText("holdout")).toHaveLength(2);
    expect(screen.getAllByText("keyframe")).toHaveLength(3);
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:local-review");
    expect(revoke).toHaveBeenCalledWith("blob:local-diff");
  });
  it("reconstructs recognized English captions into editable text without a fake image preview", async () => {
    const videoId = "video-" + "b".repeat(64);
    vi.spyOn(studioApi, "uploadVideo").mockResolvedValue({ id: videoId, bytes: 80, format: "mp4" });
    const ocr = {
      status: "experimental-ocr" as const,
      projectId: "studio-" + "c".repeat(20), revision: 2,
      lines: [{ id: "ocr-caption-1", text: "STUDIO", confidence: .963,
        box: { x: 30, y: 50, width: 250, height: 90 } }],
      sampleTimes: [0,1.4,2.8], dimensions: { width: 640, height: 360 },
      averageConfidence: .963, limitations: ["English only"],
    };
    const reconstruct = vi.spyOn(studioApi, "reconstructTextVideo").mockResolvedValue(ocr);
    const preview = vi.spyOn(studioApi, "loadMultiVideoReviewUrl");
    const created = vi.fn();
    render(<StudioVideoToCodePanel workspacePath="D:/studio" ocrAvailable onCreated={created} />);
    fireEvent.change(screen.getByLabelText("Video reconstruction mode"), { target: { value: "text" } });
    fireEvent.change(screen.getByLabelText("Video reference file"), { target: {
      files: [new File([new Uint8Array(80)], "captions.mp4", { type: "video/mp4" })],
    } });
    fireEvent.click(screen.getByRole("button", { name: "Create editable layers" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith(ocr));
    expect(reconstruct).toHaveBeenCalledWith("D:/studio", videoId);
    expect(screen.getByText(/STUDIO \(96.3%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Font and appearance are approximate/)).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
  });
  it("creates separate editable timeline captions with explicitly approximate boundaries", async () => {
    const videoId="video-"+ "b".repeat(64);
    vi.spyOn(studioApi,"uploadVideo").mockResolvedValue({id:videoId,bytes:80,format:"mp4"});
    const report={
      status:"experimental-ocr-timeline" as const,
      projectId:"studio-"+ "d".repeat(20),revision:2,
      captions:[
        {id:"ocr-caption-1",text:"STUDIO",confidence:.95,startFrame:0,endFrame:40,
          box:{x:80,y:125,width:240,height:75}},
        {id:"ocr-caption-2",text:"HELLO",confidence:.94,startFrame:41,endFrame:89,
          box:{x:80,y:125,width:200,height:75}}],
      sampleTimes:[0,.35,.7,1.05,1.4,1.75,2.1,2.45,2.8],
      dimensions:{width:640,height:360},averageConfidence:.945,
      limitations:["Approximate timing"],
    };
    const reconstruct=vi.spyOn(studioApi,"reconstructTextTimelineVideo").mockResolvedValue(report);
    const preview=vi.spyOn(studioApi,"loadMultiVideoReviewUrl");
    const created=vi.fn();
    render(<StudioVideoToCodePanel workspacePath="D:/studio"
      ocrAvailable ocrTimelineAvailable onCreated={created}/>);
    fireEvent.change(screen.getByLabelText("Video reconstruction mode"),
      {target:{value:"timeline"}});
    fireEvent.change(screen.getByLabelText("Video reference file"),
      {target:{files:[new File([new Uint8Array(80)],"captions.mp4",{type:"video/mp4"})]}});
    fireEvent.click(screen.getByRole("button",{name:"Create editable layers"}));
    await waitFor(()=>expect(created).toHaveBeenCalledWith(report));
    expect(reconstruct).toHaveBeenCalledWith("D:/studio",videoId);
    expect(screen.getByText(/STUDIO — frames/)).toBeInTheDocument();
    expect(screen.getByText(/Visibility boundaries are estimated halfway/)).toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
  });
  it("does not expose OCR mode on legacy Studio backends", () => {
    render(<StudioVideoToCodePanel workspacePath="D:/studio" onCreated={vi.fn()} />);
    expect(screen.queryByRole("combobox", { name: "Video reconstruction mode" })).not.toBeInTheDocument();
  });
  it("refuses oversized media before upload and preserves explicit warnings", () => {
    const importVideo = vi.spyOn(studioApi, "uploadVideo");
    render(<StudioVideoToCodePanel workspacePath="D:/demo" onCreated={vi.fn()} />);
    const huge = new File([new Uint8Array(80)], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(huge, "size", { value: 14 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Video reference file"), { target: { files: [huge] } });
    fireEvent.click(screen.getByRole("button", { name: "Create editable layers" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/12-MiB/);
    expect(importVideo).not.toHaveBeenCalled();
  });
  it("shows a recoverable reconstruction error without reporting a project", async () => {
    vi.spyOn(studioApi, "uploadVideo").mockResolvedValue({
      id: "video-" + "b".repeat(64), bytes: 80, format: "mp4",
    });
    vi.spyOn(studioApi, "reconstructMultiVideo").mockRejectedValue(
      new Error("Foreground identities changed; review manually"));
    const created = vi.fn();
    render(<StudioVideoToCodePanel workspacePath="D:/demo" onCreated={created} />);
    fireEvent.change(screen.getByLabelText("Video reference file"), { target: {
      files: [new File([new Uint8Array(80)], "bad.mp4", { type: "video/mp4" })],
    } });
    fireEvent.click(screen.getByRole("button", { name: "Create editable layers" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/identities changed/));
    expect(created).not.toHaveBeenCalled();
  });
});
