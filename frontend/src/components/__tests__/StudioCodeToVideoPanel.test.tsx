import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioCodeToVideoPanel } from "../StudioCodeToVideoPanel";
import { studioApi } from "../../services/studioApi";

beforeEach(() => {
  vi.spyOn(studioApi, "listCodeVideoJobs").mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Studio Code-to-Video editor panel", () => {
  it("renders Studio HTML/React wrapper to MP4 and offers a downloadable video", async () => {
    const output = {
      id: "codevideo-" + "a".repeat(24), bytes: 4000, width: 640, height: 360,
      fps: 12, frameCount: 24, source: "studio" as const,
    };
    const start = vi.spyOn(studioApi, "queueCodeVideo").mockResolvedValue({
      id: "codejob-" + "b".repeat(24), status: "completed", framesCompleted: 24,
      frameCount: 24, queuedAt: new Date().toISOString(), result: output,
    });
    const read = vi.spyOn(studioApi, "loadCodeVideo").mockResolvedValue("blob:code-video-test");
    const revoke = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true });
    const projectId = "studio-" + "b".repeat(20);
    const { unmount } = render(<StudioCodeToVideoPanel workspacePath="D:/studio"
      projectId={projectId} />);
    fireEvent.click(screen.getByRole("button", { name: "Render MP4" }));
    await waitFor(() => expect(start).toHaveBeenCalledWith("D:/studio", {
      projectId, width: 640, height: 360, fps: 12, durationSeconds: 2,
    }));
    await waitFor(() => expect(read).toHaveBeenCalledWith("D:/studio", output.id));
    expect(document.querySelector('video[aria-label="Rendered code to MP4"]')?.getAttribute("src"))
      .toBe("blob:code-video-test");
    expect(screen.getByText("Download MP4").getAttribute("download")).toBe(output.id + ".mp4");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:code-video-test");
  });
  it("requires an explicit trust decision before rendering local HTML", async () => {
    const start = vi.spyOn(studioApi, "queueCodeVideo").mockResolvedValue({
      id: "codejob-" + "c".repeat(24), status: "completed", framesCompleted: 24,
      frameCount: 24, queuedAt: new Date().toISOString(),
      result: { id: "codevideo-" + "c".repeat(24), bytes: 2500, width: 640,
        height: 360, fps: 12, frameCount: 24, source: "html" },
    });
    vi.spyOn(studioApi, "loadCodeVideo").mockResolvedValue("blob:local-html-video");
    render(<StudioCodeToVideoPanel workspacePath="D:/studio" projectId={"studio-" + "a".repeat(20)} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Code video source" }),
      { target: { value: "html" } });
    fireEvent.change(screen.getByLabelText("Source HTML file"), { target: { files: [
      new File(["<!doctype html><html><body>Test</body></html>"], "animation.html", {
        type: "text/html",
      }),
    ] } });
    expect(screen.getByRole("button", { name: "Render MP4" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Trust HTML source"));
    fireEvent.click(screen.getByRole("button", { name: "Render MP4" }));
    await waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(start.mock.calls[0][1]).toMatchObject({
      trustLocalHtml: true, width: 640, height: 360, fps: 12, durationSeconds: 2,
    });
    expect(start.mock.calls[0][1].html).toContain("<!doctype html>");
  });
  it("offers cancel during an active render, then reports cancellation", async () => {
    const id = "codejob-" + "d".repeat(24);
    vi.spyOn(studioApi, "queueCodeVideo").mockResolvedValue({
      id, status: "running", queuedAt: new Date().toISOString(),
      frameCount: 60, framesCompleted: 4,
    });
    const cancelled = vi.spyOn(studioApi, "cancelCodeVideo").mockResolvedValue({
      id, status: "cancelling", queuedAt: new Date().toISOString(),
      frameCount: 60, framesCompleted: 4,
    });
    vi.spyOn(studioApi, "inspectCodeVideo").mockResolvedValue({
      id, status: "cancelled", queuedAt: new Date().toISOString(),
      frameCount: 60, framesCompleted: 4,
    });
    render(<StudioCodeToVideoPanel workspacePath="D:/studio"
      projectId={"studio-" + "e".repeat(20)} />);
    fireEvent.click(screen.getByRole("button", { name: "Render MP4" }));
    const cancel = await screen.findByRole("button", { name: "Cancel code video render" });
    expect(screen.getByRole("status")).toHaveTextContent("running");
    fireEvent.click(cancel);
    await waitFor(() => expect(cancelled).toHaveBeenCalledWith("D:/studio", id));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("cancelled"));
    expect(screen.queryByRole("button", { name: "Cancel code video render" })).not.toBeInTheDocument();
  });

  it("uploads a trusted PCM16 WAV and passes only its workspace asset ID to the job", async () => {
    const file = new File([new Uint8Array(64)], "narration.wav", {type:"audio/wav"});
    const audio = {id:"audio-"+"d".repeat(64),bytes:64,sampleRate:24000,channels:1,seconds:.01};
    const upload=vi.spyOn(studioApi,"uploadAudio").mockResolvedValue(audio);
    const jobId="codejob-"+"d".repeat(24);
    const videoId="codevideo-"+"d".repeat(24);
    const queue=vi.spyOn(studioApi,"queueCodeVideo").mockResolvedValue({
      id:jobId,status:"completed",framesCompleted:24,frameCount:24,
      queuedAt:new Date().toISOString(),result:{
        id:videoId,bytes:3800,width:640,height:360,fps:12,
        frameCount:24,source:"studio",
      },
    });
    vi.spyOn(studioApi,"loadCodeVideo").mockResolvedValue("blob:audio-video");
    render(<StudioCodeToVideoPanel workspacePath="D:/studio"
      projectId={"studio-"+"f".repeat(20)}/>);
    fireEvent.change(screen.getByLabelText("Code video audio file"),
      {target:{files:[file]}});
    fireEvent.click(screen.getByRole("button",{name:"Render MP4"}));
    await waitFor(()=>expect(upload).toHaveBeenCalledWith("D:/studio",file));
    await waitFor(()=>expect(queue).toHaveBeenCalledOnce());
    expect(queue.mock.calls[0][1].audioAssetId).toBe(audio.id);
    expect(screen.getByText("Download MP4")).toBeInTheDocument();
  });

  it("restores job history and opens a prior MP4 without submitting a new render", async () => {
    const oldId = "codejob-" + "4".repeat(24);
    const videoId = "codevideo-" + "a".repeat(24);
    vi.mocked(studioApi.listCodeVideoJobs).mockResolvedValue([
      { id: oldId, status: "completed", framesCompleted: 24, frameCount: 24,
        queuedAt: new Date().toISOString(), result: {
          id: videoId, bytes: 3500, width: 640, height: 360, fps: 12,
          frameCount: 24, source: "studio",
        }},
      { id: "codejob-" + "5".repeat(24), status: "interrupted",
        framesCompleted: 9, frameCount: 120, queuedAt: new Date().toISOString(),
        error: "Renderer process stopped" },
    ]);
    const previous = vi.spyOn(studioApi, "loadCodeVideo").mockResolvedValue("blob:old-mp4");
    const queue = vi.spyOn(studioApi, "queueCodeVideo");
    render(<StudioCodeToVideoPanel workspacePath="D:/studio"
      projectId={"studio-" + "b".repeat(20)} />);
    const open = await screen.findByRole("button", { name: "Open saved video " + oldId });
    expect(screen.getByText(/manual retry required/)).toBeInTheDocument();
    fireEvent.click(open);
    await waitFor(() => expect(previous).toHaveBeenCalledWith("D:/studio", videoId));
    expect(screen.getByText("Download MP4")).toHaveAttribute("download", videoId + ".mp4");
    expect(queue).not.toHaveBeenCalled();
  });

  it("does not attach an old workspace MP4 if workspace changes mid-download", async () => {
    const oldId = "codejob-" + "7".repeat(24);
    const videoId = "codevideo-" + "8".repeat(24);
    vi.mocked(studioApi.listCodeVideoJobs).mockResolvedValue([
      { id: oldId, status:"completed", queuedAt:new Date().toISOString(),
        framesCompleted:4, frameCount:4, result:{
          id:videoId,bytes:4000,width:640,height:360,fps:4,frameCount:4,
          source:"studio",
        }},
    ]);
    let complete!: (url: string) => void;
    vi.spyOn(studioApi, "loadCodeVideo").mockImplementation(
      () => new Promise(resolve => { complete = resolve; }));
    const revoke = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {value:revoke,configurable:true});
    const id = "studio-" + "9".repeat(20);
    const view = render(<StudioCodeToVideoPanel workspacePath="D:/first" projectId={id} />);
    fireEvent.click(await screen.findByRole("button", {name:"Open saved video " + oldId}));
    view.rerender(<StudioCodeToVideoPanel workspacePath="D:/second" projectId={id}/>);
    await act(async () => complete("blob:old-workspace"));
    expect(revoke).toHaveBeenCalledWith("blob:old-workspace");
    expect(screen.queryByText("Download MP4")).not.toBeInTheDocument();
  });

  it("locks actions when disabled", async () => {
    const start = vi.spyOn(studioApi, "queueCodeVideo");
    render(<StudioCodeToVideoPanel workspacePath="D:/studio" disabled
      projectId={"studio-" + "a".repeat(20)} />);
    expect(screen.getByRole("button", { name: "Render MP4" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Render MP4" }));
    expect(start).not.toHaveBeenCalled();
    await waitFor(() => expect(studioApi.listCodeVideoJobs).toHaveBeenCalled());
  });
});
