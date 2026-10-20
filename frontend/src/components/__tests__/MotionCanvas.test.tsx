import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MotionCanvas } from '../MotionCanvas';
import type { MotionProject } from '../../services/motionStudioApi';

const project: MotionProject = {
  schemaVersion: 1, id: 'motion-' + 'b'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Pointer test', revision: 2, createdAt: '', updatedAt: '',
  composition: {
    width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 },
    durationFrames: 90, background: '#000000',
    layers: [{ id: 'block', kind: 'rect', x: 100, y: 100, width: 200,
      height: 100, rotation: 0, opacity: 1, fill: '#FFFFFF', tracks: [] }],
  },
};
afterEach(() => cleanup());
function mounted() {
  const onEdit = vi.fn();
  const onSelectLayer = vi.fn();
  const onStopPlayback = vi.fn();
  render(<MotionCanvas project={project} frame={0} selectedLayer="block" isActive busy={false}
    snapping onEdit={onEdit} onSelectLayer={onSelectLayer} onStopPlayback={onStopPlayback} />);
  const svg = screen.getByRole('img', { name: /Motion preview frame/ });
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 960, height: 540, bottom: 540, right: 960, x: 0, y: 0, toJSON: () => ({}),
  });
  return { svg, onEdit, onSelectLayer, onStopPlayback };
}
describe('Motion Canvas native pointer interaction', () => {
  it('saves one revision-guarded transaction only after moving and releasing a layer', () => {
    const { svg, onEdit, onSelectLayer, onStopPlayback } = mounted();
    const layer = svg.querySelector('[data-motion-layer="block"]')!;
    fireEvent.pointerDown(layer, { pointerId: 3, button: 0, clientX: 110, clientY: 95 });
    expect(onSelectLayer).toHaveBeenCalledWith('block');
    expect(onStopPlayback).toHaveBeenCalledOnce();
    fireEvent.pointerMove(svg, { pointerId: 3, clientX: 127, clientY: 115 });
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.pointerUp(svg, { pointerId: 3, clientX: 127, clientY: 115 });
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-property', layerId: 'block', property: 'x', value: 130 },
      { type: 'set-property', layerId: 'block', property: 'y', value: 140 },
    ], 'Layer moved on canvas');
  });
  it('resizes a rectangle and persists a revision-guarded scene replacement', () => {
    const { svg, onEdit } = mounted();
    const handle = screen.getByRole('button', { name: 'Resize selected rectangle' });
    fireEvent.pointerDown(handle, { pointerId: 6, button: 0, clientX: 150, clientY: 100 });
    fireEvent.pointerMove(svg, { pointerId: 6, clientX: 170, clientY: 110 });
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.pointerUp(svg, { pointerId: 6, clientX: 170, clientY: 110 });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'replace-composition', composition: expect.objectContaining({ layers: [
        expect.objectContaining({ id: 'block', width: 240, height: 120 }),
      ] }) },
    ], 'Rectangle resized on canvas');
  });
  it('rotates a layer through its visible transform handle', () => {
    const { svg, onEdit } = mounted();
    const handle = screen.getByRole('button', { name: 'Rotate selected layer' });
    fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientX: 100, clientY: 34 });
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: 141, clientY: 75 });
    fireEvent.pointerUp(svg, { pointerId: 7, clientX: 141, clientY: 75 });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-property', layerId: 'block', property: 'rotation', value: 90 },
    ], 'Layer rotated on canvas');
  });
  it('nudges a selected layer with keyboard shortcuts', () => {
    const { svg, onEdit } = mounted();
    fireEvent.keyDown(svg, { key: 'ArrowRight', shiftKey: true });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-property', layerId: 'block', property: 'x', value: 110 },
    ], 'Layer nudged with keyboard');
    fireEvent.keyDown(svg, { key: 'ArrowLeft', altKey: true });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-property', layerId: 'block', property: 'rotation', value: -15 },
    ], 'Layer rotated with keyboard');
    fireEvent.keyDown(svg, { key: 'ArrowRight', ctrlKey: true, shiftKey: true });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'replace-composition', composition: expect.objectContaining({ layers: [
        expect.objectContaining({ id: 'block', width: 210, height: 100 }),
      ] }) },
    ], 'Rectangle resized with keyboard');
  });
  it('does not persist a gesture cancelled by the browser', () => {
    const { svg, onEdit } = mounted();
    const layer = svg.querySelector('[data-motion-layer="block"]')!;
    fireEvent.pointerDown(layer, { pointerId: 4, button: 0, clientX: 110, clientY: 95 });
    fireEvent.pointerMove(svg, { pointerId: 4, clientX: 200, clientY: 220 });
    fireEvent.pointerCancel(svg, { pointerId: 4 });
    expect(onEdit).not.toHaveBeenCalled();
  });
  it('aborts a captured drag if its project revision changes before release', () => {
    const onEdit = vi.fn();
    const props = { project, frame: 0, selectedLayer: 'block', isActive: true, busy: false,
      snapping: true, onEdit, onSelectLayer: vi.fn(), onStopPlayback: vi.fn() };
    const view = render(<MotionCanvas {...props} />);
    const svg = screen.getByRole('img', { name: /Motion preview frame/ });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0,
      width: 960, height: 540, bottom: 540, right: 960, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(svg.querySelector('[data-motion-layer="block"]')!, { pointerId: 8, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { pointerId: 8, clientX: 140, clientY: 110 });
    view.rerender(<MotionCanvas {...props} project={{ ...project, revision: 3 }} />);
    fireEvent.pointerUp(svg, { pointerId: 8, clientX: 140, clientY: 110 });
    expect(onEdit).not.toHaveBeenCalled();
  });
  it('does not allow editing while busy', () => {
    const onEdit = vi.fn();
    render(<MotionCanvas project={project} frame={0} selectedLayer="block" isActive busy
      snapping onEdit={onEdit} onSelectLayer={vi.fn()} onStopPlayback={vi.fn()} />);
    const svg = screen.getByRole('img', { name: /Motion preview frame/ });
    const layer = svg.querySelector('[data-motion-layer="block"]')!;
    fireEvent.pointerDown(layer, { pointerId: 5, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { pointerId: 5, clientX: 130, clientY: 100 });
    fireEvent.pointerUp(svg, { pointerId: 5, clientX: 130, clientY: 100 });
    expect(onEdit).not.toHaveBeenCalled();
  });
});
