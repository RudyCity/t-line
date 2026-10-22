import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudioBrandKitPanel } from '../StudioBrandKitPanel';
import { studioApi, type StudioBrandKit } from '../../services/studioApi';

vi.mock('../../services/studioApi', () => ({ studioApi: {
  brandKit: vi.fn(), saveBrandKit: vi.fn(), uploadImage: vi.fn(),
} }));
const kit = (): StudioBrandKit => ({
  revision: 0, name: 'Workspace Brand', primary: '#38bdf8', accent: '#f97316',
  background: '#171b28', textColor: '#f7f8ff', fontFamily: 'Arial', updatedAt: '',
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(studioApi.brandKit).mockResolvedValue(kit());
  vi.mocked(studioApi.saveBrandKit).mockImplementation(async (_ws, rev, input) =>
    ({ ...input, revision: rev + 1, updatedAt: '2026-10-22T00:00:00Z' }));
  vi.mocked(studioApi.uploadImage).mockResolvedValue({
    id: 'asset-' + 'f'.repeat(64), bytes: 123, width: 100, height: 100,
  } as any);
});
afterEach(() => cleanup());

describe('Workspace Studio Brand Kit editor', () => {
  it('loads existing brand, edits colors/font and saves with explicit revision check', async () => {
    render(<StudioBrandKitPanel workspacePath="D:/studio"/>);
    await screen.findByDisplayValue('Workspace Brand');
    fireEvent.click(screen.getByText('Workspace Brand Kit'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Studio brand name' }),
      { target: { value: 'Laris' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Studio brand font' }),
      { target: { value: 'Georgia' } });
    expect(studioApi.saveBrandKit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Brand Kit' }));
    await waitFor(() => expect(studioApi.saveBrandKit).toHaveBeenCalledWith(
      'D:/studio', 0, expect.objectContaining({ name: 'Laris', fontFamily: 'Georgia' }),
    ));
    expect(await screen.findByText('Saved Brand Kit revision 1')).toBeInTheDocument();
  });
  it('reports optimistic conflicts without pretending settings were persisted', async () => {
    vi.mocked(studioApi.saveBrandKit).mockRejectedValue(new Error('Brand Kit revision conflict'));
    render(<StudioBrandKitPanel workspacePath="D:/studio"/>);
    await screen.findByDisplayValue('Workspace Brand');
    fireEvent.click(screen.getByText('Workspace Brand Kit'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Brand Kit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('revision conflict');
  });
});
