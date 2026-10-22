import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionTypographyPanel } from '../MotionTypographyPanel';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: { typography: vi.fn() } }));
const source = (): MotionProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), workspaceRoot: 'D:/studio',
  name: 'Type', revision: 2, createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, durationFrames: 90,
    fps: { numerator: 30, denominator: 1 }, background: '#171B28',
    layers: [{ kind: 'text', id: 'title', text: 'Hello', fontFamily: 'Arial',
      fontSize: 64, x: 120, y: 220, width: 600, height: 90,
      fill: '#FFFFFF', opacity: 1, rotation: 0, tracks: [] }],
  },
});
beforeEach(() => { vi.clearAllMocks(); vi.mocked(motionStudioApi.typography).mockResolvedValue(source()); });
afterEach(() => cleanup());

describe('Native Motion advanced typography', () => {
  it('previews per-word reveal safely, then applies only on explicit click', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    render(<MotionTypographyPanel workspacePath="D:/studio" project={source()}
      selectedLayer="title" busy={false} preview={null} onPreview={onPreview} onApply={onApply}/>);
    fireEvent.click(screen.getByText('Advanced Typography'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Motion typography style' }),
      { target: { value: 'word-rise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.typography).toHaveBeenCalledWith(
      'D:/studio', source().id, 2, {
        targetLayerId: 'title', style: 'word-rise', startFrame: 0, durationFrames: 60,
      }, true));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({ targetLayerId: 'title', style: 'word-rise', startFrame: 0, durationFrames: 60 });
  });
  it('blocks invalid frames and non-text selections', () => {
    const ui = render(<MotionTypographyPanel workspacePath="D:/studio" project={source()}
      selectedLayer="title" busy={false} preview={null} onPreview={vi.fn()} onApply={vi.fn()}/>);
    fireEvent.click(screen.getByText('Advanced Typography'));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Typography start frame' }),
      { target: { value: '90' } });
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    ui.rerender(<MotionTypographyPanel workspacePath="D:/studio" project={source()}
      selectedLayer={null} busy={false} preview={null} onPreview={vi.fn()} onApply={vi.fn()}/>);
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  });
});
