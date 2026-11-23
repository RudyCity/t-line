import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileViewerTab } from '../FileViewerTab';

vi.mock('../monacoSetup', () => ({ monaco: {} }));
vi.mock('@monaco-editor/react', () => ({
  default: () => null,
  loader: { config: vi.fn(), init: vi.fn(() => Promise.resolve()) },
}));

describe('FileViewerTab - Multimedia & Document Instant Viewers', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders dedicated HTML5 video player for .mp4 and .webm files', () => {
    const { container } = render(<FileViewerTab filePath="D:/assets/intro.mp4" token="test-tok" />);
    expect(screen.getByText('Video Player')).toBeInTheDocument();
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('src')).toContain('/api/fs/raw?path=D%3A%2Fassets%2Fintro.mp4');
    expect(video?.getAttribute('src')).toContain('token=test-tok');
  });

  it('renders dedicated HTML5 audio player for .mp3 and .wav files', () => {
    const { container } = render(<FileViewerTab filePath="D:/music/track.mp3" token="test-tok" />);
    expect(screen.getByText('Audio Player')).toBeInTheDocument();
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio?.getAttribute('src')).toContain('/api/fs/raw?path=D%3A%2Fmusic%2Ftrack.mp3');
  });

  it('renders PDF iframe viewer for .pdf files', () => {
    const { container } = render(<FileViewerTab filePath="D:/docs/manual.pdf" token="test-tok" />);
    expect(screen.getByText('PDF Document')).toBeInTheDocument();
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toContain('/api/fs/raw?path=D%3A%2Fdocs%2Fmanual.pdf');
  });

  it('renders image viewer for .png files', () => {
    const { container } = render(<FileViewerTab filePath="D:/images/logo.png" token="test-tok" />);
    expect(screen.getByText('Image Preview')).toBeInTheDocument();
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('src')).toContain('/api/fs/raw?path=D%3A%2Fimages%2Flogo.png');
  });

  it('provides universal Copy Path and Reveal buttons that copy to clipboard', async () => {
    render(<FileViewerTab filePath="D:/assets/video.mp4" token="test-tok" />);
    const copyBtn = screen.getByRole('button', { name: /copy path/i });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('D:/assets/video.mp4');
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    const revealBtn = screen.getByRole('button', { name: /reveal/i });
    expect(revealBtn).toBeInTheDocument();
    fireEvent.click(revealBtn);
    expect(global.fetch).toHaveBeenCalledWith('/api/fs/open-explorer', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ path: 'D:/assets/video.mp4' }),
    }));
  });

  it('supports video playback speed adjustment and loop toggling', () => {
    const { container } = render(<FileViewerTab filePath="D:/assets/clip.webm" token="test-tok" />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();

    const speed2x = screen.getByRole('button', { name: '2x' });
    fireEvent.click(speed2x);
    expect(video?.playbackRate).toBe(2);

    const loopBtn = screen.getByRole('button', { name: /loop/i });
    fireEvent.click(loopBtn);
    expect(video?.loop).toBe(true);

    fireEvent.click(loopBtn);
    expect(video?.loop).toBe(false);
  });

  it('shows error fallback card with reveal button when video decoding fails', () => {
    const { container } = render(<FileViewerTab filePath="D:/assets/corrupt.mp4" token="test-tok" />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();

    // Trigger video error
    fireEvent.error(video!);

    expect(screen.getByText('Playback Error')).toBeInTheDocument();
    expect(screen.getByText(/unable to decode video/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open in explorer/i })).toBeInTheDocument();
  });

  it('shows error fallback card when audio decoding fails', () => {
    const { container } = render(<FileViewerTab filePath="D:/music/corrupt.wav" token="test-tok" />);
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();

    // Trigger audio error
    fireEvent.error(audio!);

    expect(screen.getByText('Playback Error')).toBeInTheDocument();
    expect(screen.getByText(/unable to decode audio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open in explorer/i })).toBeInTheDocument();
  });
});
