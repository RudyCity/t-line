import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioCodeToVideoPanel } from "../StudioCodeToVideoPanel";
import { studioApi } from "../../services/studioApi";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Studio Code-to-Video editor panel", () => {
  it("renders Studio HTML/React wrapper to MP4 and offers a downloadable video", async () => {
    const output = {
      id: "codevideo-" + "a".repeat(24), bytes: 4000, width: 640, height: 360,
      fps: 12, frameCount: 24, source: "studio" as const,
    };
    const start = vi.spyOn(studioApi, "codeToVideo").mockResolvedValue(output);
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
    const start = vi.spyOn(studioApi, "codeToVideo").mockResolvedValue({
      id: "codevideo-" + "c".repeat(24), bytes: 2500, width: 640, height: 360,
      fps: 12, frameCount: 24, source: "html" as const,
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
  it("locks actions when disabled", () => {
    const start = vi.spyOn(studioApi, "codeToVideo");
    render(<StudioCodeToVideoPanel workspacePath="D:/studio" disabled
      projectId={"studio-" + "a".repeat(20)} />);
    expect(screen.getByRole("button", { name: "Render MP4" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Render MP4" }));
    expect(start).not.toHaveBeenCalled();
  });
});
