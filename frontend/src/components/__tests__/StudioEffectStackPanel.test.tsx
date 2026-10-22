import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StudioEffectStackPanel } from '../StudioEffectStackPanel';
import type { StudioProject } from '../../services/studioApi';

const fixture = (): StudioProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Stack', revision: 3, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: {
    width: 1920, height: 1080, fps: { numerator: 30, denominator: 1 },
    background: '#171B28', durationFrames: 120, layers: [],
    effectStack: [
      { id: 'fx-fade', effectId: 'entrance-fade-in', enabled: true, targetLayerId: 'title',
        startFrame: 0, durationFrames: 45, params: { speed: 1.25 } },
      { id: 'fx-glow', effectId: 'graphic-glow', enabled: true,
        startFrame: 10, durationFrames: 70 },
    ],
  },
});

describe('native non-destructive effect stack inspector', () => {
  it('toggles, reorders, removes and updates one layer effect without modifying the project prop', () => {
    const project = fixture(), operation = vi.fn();
    render(<StudioEffectStackPanel project={project} busy={false} onChange={operation} />);
    fireEvent.click(screen.getByText(/Effect Stack/));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable effect fx-fade' }));
    expect(operation).toHaveBeenCalledWith({ type: 'toggle', id: 'fx-fade', enabled: false });
    fireEvent.click(screen.getByRole('button', { name: 'Move effect down fx-fade' }));
    expect(operation).toHaveBeenCalledWith({ type: 'move', id: 'fx-fade', toIndex: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Remove effect fx-glow' }));
    expect(operation).toHaveBeenCalledWith({ type: 'remove', id: 'fx-glow' });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Stack duration fx-fade' }),
      { target: { value: '30' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Stack param fx-fade speed' }),
      { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save effect settings fx-fade' }));
    expect(operation).toHaveBeenCalledWith({ type: 'update', id: 'fx-fade',
      changes: { startFrame: 0, durationFrames: 30, params: { speed: 1.5 } } });
    expect(project.composition.effectStack?.[0].durationFrames).toBe(45);
  });
  it('disables all modifications while saving', () => {
    const operation = vi.fn();
    render(<StudioEffectStackPanel project={fixture()} busy onChange={operation} />);
    fireEvent.click(screen.getByText(/Effect Stack/));
    expect(screen.getByRole('checkbox', { name: 'Enable effect fx-fade' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save effect settings fx-fade' })).toBeDisabled();
  });
});
