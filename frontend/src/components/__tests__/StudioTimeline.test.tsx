import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StudioProject } from '../../services/studioApi';
import { StudioTimeline } from '../StudioTimeline';

const sample: StudioProject = {
  schemaVersion: 1, id: 'motion-' + 'c'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Timeline', revision: 2, createdAt: '', updatedAt: '',
  composition: {
    width: 1920, height: 1080, durationFrames: 90, background: '#000000',
    fps: { numerator: 30, denominator: 1 },
    layers: [{
      id: 'title', kind: 'text', text: 'Title', x: 0, y: 0,
      width: 100, height: 50, rotation: 0, opacity: 1, fill: '#FFFFFF',
      fontSize: 48, fontFamily: 'Arial',
      tracks: [{ property: 'x', keyframes: [
        { frame: 0, value: 0, easing: 'step' },
        { frame: 30, value: 200, easing: 'linear' },
      ] }],
    }],
  },
};
afterEach(() => cleanup());
function setup() {
  const onEdit = vi.fn();
  const onError = vi.fn();
  const onFrame = vi.fn();
  const onLayer = vi.fn();
  const rendered = render(<StudioTimeline project={sample} currentFrame={0} selectedLayer="title"
    busy={false} isActive onEdit={onEdit} onError={onError} onFrame={onFrame} onLayer={onLayer} />);
  return { rendered, onEdit, onError, onFrame, onLayer };
}
describe('Studio Timeline native keyframe editor', () => {
  it('selects, retimes with keyboard-friendly frame input, and changes easing', () => {
    const { onEdit, onFrame, onLayer } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'title x frame 0' }));
    expect(onFrame).toHaveBeenCalledWith(0);
    expect(onLayer).toHaveBeenCalledWith('title');
    fireEvent.change(screen.getByLabelText('Outgoing easing'), { target: { value: 'easeInOut' } });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-track', layerId: 'title', track: expect.objectContaining({
        keyframes: [expect.objectContaining({ frame: 0, easing: 'easeInOut' }), expect.any(Object)],
      }) },
    ], 'Keyframe easing updated');
    fireEvent.change(screen.getByLabelText('Frame'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-track', layerId: 'title', track: expect.objectContaining({
        keyframes: [expect.objectContaining({ frame: 15 }), expect.objectContaining({ frame: 30 })],
      }) },
    ], 'Keyframe moved');
  });
  it('rejects frame conflicts and keeps both keyframes', () => {
    const { onEdit, onError } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'title x frame 0' }));
    fireEvent.change(screen.getByLabelText('Frame'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(onEdit).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('already occupies'));
    expect(screen.getAllByRole('button', { name: /title x frame/ })).toHaveLength(2);
  });
  it('moves via pointer capture only on release, and cancels interrupted drags', () => {
    const { onEdit } = setup();
    const lane = document.querySelector('[data-timeline-lane="title-x"]') as HTMLElement;
    vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 0, right: 990, bottom: 30, width: 890, height: 30, x: 100, y: 0, toJSON: () => ({}),
    });
    const marker = screen.getByRole('button', { name: 'title x frame 30' });
    fireEvent.pointerDown(marker, { pointerId: 5, button: 0, clientX: 400 });
    fireEvent.pointerMove(marker, { pointerId: 5, clientX: 500 });
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.pointerUp(marker, { pointerId: 5, clientX: 500 });
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-track', layerId: 'title', track: expect.objectContaining({
        keyframes: [expect.objectContaining({ frame: 0 }), expect.objectContaining({ frame: 40 })],
      }) },
    ], 'Keyframe moved');
  });
  it('cancels a pointer drag without persisting a new keyframe position', () => {
    const { onEdit } = setup();
    const lane = document.querySelector('[data-timeline-lane="title-x"]') as HTMLElement;
    vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 890, bottom: 30, width: 890, height: 30, x: 0, y: 0, toJSON: () => ({}),
    });
    const marker = screen.getByRole('button', { name: 'title x frame 0' });
    fireEvent.pointerDown(marker, { pointerId: 9, button: 0, clientX: 0 });
    fireEvent.pointerMove(marker, { pointerId: 9, clientX: 250 });
    fireEvent.pointerCancel(marker, { pointerId: 9, clientX: 250 });
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'title x frame 0' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('rejects a stale pointer drag when the project revision changes', () => {
    const onEdit = vi.fn();
    const args = { project: sample, currentFrame: 0, selectedLayer: 'title', busy: false,
      isActive: true, onEdit, onError: vi.fn(), onFrame: vi.fn(), onLayer: vi.fn() };
    const view = render(<StudioTimeline {...args} />);
    const lane = document.querySelector('[data-timeline-lane="title-x"]') as HTMLElement;
    vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 890, bottom: 30, width: 890, height: 30, x: 0, y: 0, toJSON: () => ({}),
    });
    const marker = screen.getByRole('button', { name: 'title x frame 30' });
    fireEvent.pointerDown(marker, { pointerId: 7, button: 0, clientX: 300 });
    fireEvent.pointerMove(marker, { pointerId: 7, clientX: 450 });
    view.rerender(<StudioTimeline {...args} project={{ ...sample, revision: 3 }} />);
    fireEvent.pointerUp(marker, { pointerId: 7, clientX: 450 });
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('deletes a selected keyframe using the server track contract', () => {
    const { onEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'title x frame 30' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete keyframe' }));
    expect(onEdit).toHaveBeenCalledWith([
      { type: 'set-track', layerId: 'title', track: expect.objectContaining({
        keyframes: [expect.objectContaining({ frame: 0 })],
      }) },
    ], 'Keyframe deleted');
  });
});
