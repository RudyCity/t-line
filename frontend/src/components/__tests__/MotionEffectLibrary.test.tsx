import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionEffectLibrary } from '../MotionEffectLibrary';
import { motionStudioApi, type MotionProject, type MotionEffectCatalogItem } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: {
  effectsPage: vi.fn(), previewEffect: vi.fn(), applyEffect: vi.fn(),
} }));
const exampleProject = (): MotionProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Effects', revision: 3, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z', composition: {
    width: 1280, height: 720, durationFrames: 120, background: '#111827',
    fps: { numerator: 30, denominator: 1 }, layers: [
      { kind: 'text', id: 'title', text: 'Hello', fontFamily: 'Arial', fontSize: 64,
        fill: '#FFFFFF', x: 100, y: 100, width: 600, height: 85, opacity: 1, rotation: 0, tracks: [] },
      { kind: 'rect', id: 'box', fill: '#FFAA00', x: 0, y: 200,
        width: 500, height: 100, rotation: 0, opacity: 1, tracks: [] },
    ],
  },
});
const effect = (id: string, category: MotionEffectCatalogItem['category'],
  targetKinds: MotionEffectCatalogItem['targetKinds'],
  parameters: MotionEffectCatalogItem['parameters'] = {}): MotionEffectCatalogItem => ({
  id, name: id, category, targetKinds, parameters, description: 'Visual effect ' + id, tags: [category],
});
const catalog = [
  effect('entrance-fade-in', 'entrance', ['text', 'rect'], { speed: {
    name: 'Speed', type: 'number', default: 1, description: 'Animation speed',
    min: 0.25, max: 3, step: 0.25,
  } }),
  effect('background-stars', 'background', ['scene'], { tint: {
    name: 'Tint', type: 'color', default: '#FFAA00', description: 'Star color',
  } }),
  effect('kinetic-switch', 'kinetic-typography', ['text'], {
    active: { name: 'Active', type: 'boolean', default: true, description: 'Enabled' },
    direction: { name: 'Direction', type: 'enum', default: 'left',
      choices: ['left', 'right'], description: 'Choose side' },
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.effectsPage).mockImplementation(async (_ws, offset) => {
    if (offset === 0) return { effects: catalog.slice(0, 2), count: 2,
      filteredTotal: catalog.length, hasMore: true };
    return { effects: catalog.slice(2), count: 1, filteredTotal: catalog.length, hasMore: false };
  });
  vi.mocked(motionStudioApi.previewEffect).mockImplementation(async () => {
    const project = exampleProject();
    project.composition.layers[0].tracks = [{ property: 'x', keyframes: [
      { frame: 0, value: 200 }, { frame: 60, value: 100 },
    ] }];
    return project;
  });
});
afterEach(() => cleanup());

function view(selectedLayer = 'title') {
  const onPreview = vi.fn();
  const onApply = vi.fn();
  const result = render(<MotionEffectLibrary workspacePath="D:/studio" project={exampleProject()}
    selectedLayer={selectedLayer} busy={false} preview={null}
    onPreview={onPreview} onApply={onApply} />);
  fireEvent.click(screen.getByText(/Effects Library/));
  return { ...result, onPreview, onApply };
}

describe('T-Line Effects Library (individual catalog)', () => {
  it('loads paginated effects, validates typed numeric parameters, previews without saving, and applies explicitly', async () => {
    const { onPreview, onApply } = view();
    await screen.findByText('3 effects');
    expect(motionStudioApi.effectsPage).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Effect parameter speed' }),
      { target: { value: '5' } });
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Effect parameter speed' }),
      { target: { value: '1.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.previewEffect).toHaveBeenCalledWith('D:/studio',
      exampleProject().id, 3, {
        effectId: 'entrance-fade-in', targetLayerId: 'title', startFrame: 0,
        durationFrames: 75, params: { speed: 1.75 },
      }));
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({
      composition: expect.any(Object),
    })));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      effectId: 'entrance-fade-in', targetLayerId: 'title', startFrame: 0,
      durationFrames: 75, params: { speed: 1.75 },
    });
  });
  it('offers scene effects without requiring a layer ID and never leaks params from earlier effects', async () => {
    const { onApply } = view();
    await screen.findByText('3 effects');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Effect parameter speed' }),
      { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Motion effect category' }),
      { target: { value: 'background' } });
    expect(screen.getByRole('combobox', { name: 'Select individual Motion effect' }))
      .toHaveValue('background-stars');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      effectId: 'background-stars', startFrame: 0, durationFrames: 75,
      params: { tint: '#FFAA00' },
    });
  });
  it('supports enum and boolean parameters and rejects too-long windows and incompatible layer selections', async () => {
    const { rerender, onApply } = view();
    await screen.findByText('3 effects');
    fireEvent.change(screen.getByRole('combobox', { name: 'Motion effect category' }),
      { target: { value: 'kinetic-typography' } });
    expect(screen.getByRole('combobox', { name: 'Select individual Motion effect' }))
      .toHaveValue('kinetic-switch');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Effect parameter active' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Effect parameter direction' }),
      { target: { value: 'right' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({
      effectId: 'kinetic-switch', targetLayerId: 'title', startFrame: 0, durationFrames: 75,
      params: { active: false, direction: 'right' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Effect duration' }),
      { target: { value: '1000' } });
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    rerender(<MotionEffectLibrary workspacePath="D:/studio" project={exampleProject()}
      selectedLayer="box" busy={false} preview={null} onPreview={vi.fn()} onApply={onApply} />);
    expect(screen.getByRole('combobox', { name: 'Select individual Motion effect' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});
