import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StudioInteractionPanel } from "../StudioInteractionPanel";
import type { StudioInteractionGraph, StudioProject } from "../../services/studioApi";

afterEach(() => cleanup());
const fixture = (graph?: StudioInteractionGraph): StudioProject => ({
  schemaVersion: 1, id: "studio-" + "a".repeat(20), workspaceRoot: "D:/test",
  name: "Interaction demo", revision: 3,
  createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z",
  composition: {
    width: 1280, height: 720, fps: { numerator: 30, denominator: 1 },
    durationFrames: 300, background: "#070d1b",
    layers: [{
      kind: "text", id: "title", x: 80, y: 100, width: 400, height: 60,
      fontSize: 48, fontFamily: "Arial", text: "Click me",
      rotation: 0, opacity: 1, fill: "#ffffff", tracks: [],
    }],
    ...(graph ? { interactionGraph: graph } : {}),
  },
});
describe("Studio Interaction Graph editor", () => {
  it("adds a click-to-replay rule for a layer", () => {
    const save = vi.fn();
    render(<StudioInteractionPanel project={fixture()} busy={false} onSave={save} onError={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Interaction target" }), { target: { value: "title" } });
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(save).toHaveBeenCalledOnce();
    const graph = save.mock.calls[0][0] as StudioInteractionGraph;
    expect(graph.version).toBe(1);
    expect(graph.bindings).toHaveLength(1);
    expect(graph.bindings[0]).toMatchObject({
      event: "click", action: "replay", target: "layer", layerId: "title",
    });
    expect(graph.bindings[0].id).toMatch(/^rule-[a-f0-9]+$/);
  });
  it("limits scroll to stage seek, supports seek progress and removes rules", () => {
    const save = vi.fn();
    const rule: StudioInteractionGraph = { version: 1, bindings: [
      { id: "rule-existing", event: "click", action: "replay", target: "stage" }
    ] };
    render(<StudioInteractionPanel project={fixture(rule)} busy={false} onSave={save} onError={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Interaction event" }), { target: { value: "scroll" } });
    expect(screen.getByRole("combobox", { name: "Interaction target" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Interaction action" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(save.mock.calls[0][0].bindings[1]).toMatchObject({
      event: "scroll", action: "seek", target: "stage"
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove interaction rule-existing" }));
    expect(save).toHaveBeenLastCalledWith(null);
  });
  it("disables rule changes during a save", () => {
    const save = vi.fn();
    render(<StudioInteractionPanel project={fixture()} busy onSave={save} onError={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Add rule" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Add rule" }));
    expect(save).not.toHaveBeenCalled();
  });
});
