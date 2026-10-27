// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StudioMultiTrackTimeline } from '../studio/StudioMultiTrackTimeline';
import type { StudioComposition } from '../../services/studioApi';

describe('StudioMultiTrackTimeline', () => {
  afterEach(() => {
    cleanup();
  });
  const mockComp: StudioComposition = {
    background: '#000000',
    fps: { numerator: 30, denominator: 1 },
    durationFrames: 90,
    width: 1920,
    height: 1080,
    layers: [
      {
        id: 'layer-text-1',
        name: 'Headline',
        kind: 'text',
        text: 'Special Announcement',
        fontSize: 48,
        color: '#ffffff',
        x: 100,
        y: 100,
      } as any,
    ],
    audioTracks: [
      {
        assetId: 'audio-bg-1',
        role: 'music',
        volume: 0.8,
        startFrame: 0,
      },
    ],
  };

  it('renders timeline with video and audio tracks derived from composition', () => {
    const onSeek = vi.fn();
    const onTogglePlay = vi.fn();

    render(
      <StudioMultiTrackTimeline
        workspacePath="C:/workspace"
        projectId="proj-1"
        composition={mockComp}
        currentFrame={0}
        fps={30}
        isPlaying={false}
        onSeek={onSeek}
        onTogglePlay={onTogglePlay}
      />
    );

    // Track headers
    expect(screen.getByText('Video 1')).toBeInTheDocument();
    expect(screen.getByText('Audio 1')).toBeInTheDocument();

    // Derived clip names
    expect(screen.getByText('Special Announcement')).toBeInTheDocument();
    expect(screen.getByText('Music 1')).toBeInTheDocument();
  });

  it('handles play/pause toggle click', () => {
    const onSeek = vi.fn();
    const onTogglePlay = vi.fn();

    render(
      <StudioMultiTrackTimeline
        workspacePath="C:/workspace"
        projectId="proj-1"
        composition={mockComp}
        currentFrame={15}
        fps={30}
        isPlaying={false}
        onSeek={onSeek}
        onTogglePlay={onTogglePlay}
      />
    );

    const playBtn = screen.getByRole('button', { name: 'Play' });
    fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('selects clip on click and triggers onSelectLayer', () => {
    const onSeek = vi.fn();
    const onTogglePlay = vi.fn();
    const onSelectLayer = vi.fn();

    render(
      <StudioMultiTrackTimeline
        workspacePath="C:/workspace"
        projectId="proj-1"
        composition={mockComp}
        currentFrame={0}
        fps={30}
        isPlaying={false}
        onSeek={onSeek}
        onTogglePlay={onTogglePlay}
        onSelectLayer={onSelectLayer}
      />
    );

    const clipElement = screen.getByText('Special Announcement');
    fireEvent.click(clipElement);

    expect(onSelectLayer).toHaveBeenCalledWith('layer-text-1');
  });

  it('supports splitting a clip at current frame', () => {
    const onCompositionChange = vi.fn();

    render(
      <StudioMultiTrackTimeline
        workspacePath="C:/workspace"
        projectId="proj-1"
        composition={mockComp}
        currentFrame={30}
        fps={30}
        isPlaying={false}
        onSeek={vi.fn()}
        onTogglePlay={vi.fn()}
        onCompositionChange={onCompositionChange}
      />
    );

    // Select clip first
    fireEvent.click(screen.getByText('Special Announcement'));

    // Click split
    const splitBtn = screen.getByRole('button', { name: /Split clip at playhead/i });
    fireEvent.click(splitBtn);

    // onCompositionChange should be called with synced composition
    expect(onCompositionChange).toHaveBeenCalled();
  });

  it('supports drag moving a clip along the track', () => {
    const onCompositionChange = vi.fn();

    render(
      <StudioMultiTrackTimeline
        workspacePath="C:/workspace"
        projectId="proj-1"
        composition={mockComp}
        currentFrame={0}
        fps={30}
        isPlaying={false}
        onSeek={vi.fn()}
        onTogglePlay={vi.fn()}
        onCompositionChange={onCompositionChange}
      />
    );

    const clipElement = screen.getByRole('button', { name: 'Clip Special Announcement' });
    
    // Start drag
    fireEvent.mouseDown(clipElement, { clientX: 100, button: 0 });
    // Move 40 pixels right (at zoom 1, pixelsPerFrame is 2, so delta is ~20 frames)
    fireEvent.mouseMove(window, { clientX: 140 });
    // Mouse up
    fireEvent.mouseUp(window);

    expect(onCompositionChange).toHaveBeenCalled();
  });

  it('supports interactive edge trimming of a clip', () => {
    const onCompositionChange = vi.fn();

    render(
      <StudioMultiTrackTimeline
        workspacePath="C:/workspace"
        projectId="proj-1"
        composition={mockComp}
        currentFrame={0}
        fps={30}
        isPlaying={false}
        onSeek={vi.fn()}
        onTogglePlay={vi.fn()}
        onCompositionChange={onCompositionChange}
      />
    );

    const trimInHandle = screen.getAllByRole('button', { name: 'Trim in handle' })[0];
    fireEvent.mouseDown(trimInHandle, { clientX: 50, button: 0 });
    fireEvent.mouseMove(window, { clientX: 70 });
    fireEvent.mouseUp(window);

    expect(onCompositionChange).toHaveBeenCalled();
  });
});
