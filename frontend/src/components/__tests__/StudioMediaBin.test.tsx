import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioMediaBin } from '../studio/StudioMediaBin';
import type { StudioProject } from '../../services/studioApi';

describe('StudioMediaBin', () => {
  const mockProject: StudioProject = {
    schemaVersion: 1,
    id: 'proj-media-1',
    name: 'Media Test Project',
    workspaceRoot: 'C:/workspace',
    revision: 2,
    createdAt: '2026-10-27T10:00:00Z',
    updatedAt: '2026-10-27T10:05:00Z',
    composition: {
      width: 1920,
      height: 1080,
      fps: { numerator: 30, denominator: 1 },
      durationFrames: 90,
      background: '#000000',
      layers: [
        {
          id: 'layer-img-1',
          name: 'Hero Graphic',
          kind: 'image',
          assetId: 'asset-img-001',
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          rotation: 0,
          opacity: 1,
          fill: '#ffffff',
          tracks: [],
        } as any,
        {
          id: 'layer-vid-1',
          name: 'B-Roll Clip',
          kind: 'video',
          assetId: 'asset-vid-002',
          x: 0,
          y: 0,
          width: 1920,
          height: 1080,
          rotation: 0,
          opacity: 1,
          fill: '#ffffff',
          tracks: [],
        } as any,
      ],
      audioTracks: [
        {
          assetId: 'audio-trk-003',
          role: 'music',
          volume: 0.75,
          startFrame: 0,
        },
      ],
    },
  };

  it('renders navigation tabs and defaults to layers view', () => {
    render(
      <StudioMediaBin
        workspacePath="C:/workspace"
        project={mockProject}
        busy={false}
        selectedLayer={null}
        onSelectLayer={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Layers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Effects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Audio/i })).toBeInTheDocument();
  });

  it('switches to Media tab and displays project assets with metadata', () => {
    const onSelectLayer = vi.fn();

    render(
      <StudioMediaBin
        workspacePath="C:/workspace"
        project={mockProject}
        busy={false}
        selectedLayer={null}
        onSelectLayer={onSelectLayer}
      />
    );

    // Switch to Media tab
    fireEvent.click(screen.getByRole('button', { name: /Media/i }));

    // Should display media items
    expect(screen.getByText('Hero Graphic')).toBeInTheDocument();
    expect(screen.getByText('800×600')).toBeInTheDocument();
    expect(screen.getByText('B-Roll Clip')).toBeInTheDocument();
    expect(screen.getByText('Audio 1 (audio-tr)')).toBeInTheDocument();
    expect(screen.getByText('Vol 75%')).toBeInTheDocument();

    // Clicking an asset selects the layer
    fireEvent.click(screen.getByText('Hero Graphic'));
    expect(onSelectLayer).toHaveBeenCalledWith('layer-img-1');
  });

  it('filters media assets by kind', () => {
    render(
      <StudioMediaBin
        workspacePath="C:/workspace"
        project={mockProject}
        busy={false}
        selectedLayer={null}
        onSelectLayer={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Media/i }));

    // Click 'audio' filter pill
    const audioPill = screen.getByRole('button', { name: 'audio' });
    fireEvent.click(audioPill);

    expect(screen.getByText('Audio 1 (audio-tr)')).toBeInTheDocument();
    expect(screen.queryByText('Hero Graphic')).not.toBeInTheDocument();
    expect(screen.queryByText('B-Roll Clip')).not.toBeInTheDocument();
  });

  it('displays empty state when project has no media assets', () => {
    const emptyCompProject: StudioProject = {
      ...mockProject,
      composition: {
        ...mockProject.composition,
        layers: [],
        audioTracks: [],
      },
    };

    render(
      <StudioMediaBin
        workspacePath="C:/workspace"
        project={emptyCompProject}
        busy={false}
        selectedLayer={null}
        onSelectLayer={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Media/i }));
    expect(screen.getByText('No media assets found')).toBeInTheDocument();
  });
});
