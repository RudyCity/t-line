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
    expect(screen.getByRole("img", { name: /original video on the left/ })).toHaveAttribute(
      "src", "blob:local-review");
    expect(screen.getByText(/92.0%/)).toBeInTheDocument();
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:local-review");
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
