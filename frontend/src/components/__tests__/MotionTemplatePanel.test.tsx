import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionTemplatePanel } from '../MotionTemplatePanel';
import { motionStudioApi, type MotionProject } from '../../services/motionStudioApi';

vi.mock('../../services/motionStudioApi', () => ({ motionStudioApi: {
  templates: vi.fn(), previewTemplate: vi.fn(),
} }));
const project = (): MotionProject => ({
  schemaVersion: 1, id: 'motion-' + 'a'.repeat(20), revision: 2,
  workspaceRoot: 'D:/studio', name: 'Scene', createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  composition: { width: 1280, height: 720, durationFrames: 150,
    fps: { numerator: 30, denominator: 1 }, background: '#171b28', layers: [] },
});
const templates = [{ id: 'saas-feature', name: 'SaaS Feature', category: 'SaaS',
  description: 'Launch new features', align: 'left' as const, tone: 'clean' as const },
  { id: 'product-launch', name: 'Product Launch', category: 'Marketing',
    description: 'Big new announcement', align: 'center' as const, tone: 'bold' as const }];
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(motionStudioApi.templates).mockResolvedValue({ templates });
  vi.mocked(motionStudioApi.previewTemplate).mockResolvedValue(project());
});
afterEach(() => cleanup());
describe('T-Line Motion scene templates', () => {
  it('previews without committing and applies customized title only on explicit click', async () => {
    const onPreview = vi.fn(), onApply = vi.fn();
    render(<MotionTemplatePanel workspacePath="D:/studio" project={project()} busy={false}
      preview={null} onPreview={onPreview} onApply={onApply} />);
    await screen.findByText('2 templates');
    fireEvent.click(screen.getByText('Scene Templates'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Template headline' }),
      { target: { value: 'Introducing Chat AI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.previewTemplate).toHaveBeenCalledWith(
      'D:/studio', project().id, 2, {
        templateId: 'saas-feature', headline: 'Introducing Chat AI',
      },
    ));
    expect(onApply).not.toHaveBeenCalled();
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 })));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith({ templateId: 'saas-feature', headline: 'Introducing Chat AI' });
  });
  it('invalidates an outstanding preview when the user chooses another template', async () => {
    let resolve!: (p: MotionProject) => void;
    vi.mocked(motionStudioApi.previewTemplate).mockReturnValue(new Promise(result => { resolve = result; }));
    const onPreview = vi.fn();
    render(<MotionTemplatePanel workspacePath="D:/studio" project={project()} busy={false}
      preview={null} onPreview={onPreview} onApply={vi.fn()} />);
    await screen.findByText('2 templates');
    fireEvent.click(screen.getByText('Scene Templates'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(motionStudioApi.previewTemplate).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('combobox', { name: 'Select Motion scene template' }),
      { target: { value: 'product-launch' } });
    resolve(project());
    await waitFor(() => expect(onPreview).toHaveBeenCalledWith(null));
    expect(onPreview).not.toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
  });
});
