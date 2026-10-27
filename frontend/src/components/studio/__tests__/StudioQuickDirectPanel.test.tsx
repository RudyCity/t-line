import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioQuickDirectPanel } from '../StudioQuickDirectPanel';

describe('StudioQuickDirectPanel', () => {
  const defaultProps = {
    selectedId: 'proj-1',
    busy: false,
    directorAvailable: true,
    directorMediaAvailable: true,
    directorSceneImagesAvailable: true,
    directorAudioLoopAvailable: true,
    directorVoiceoverAvailable: true,
    directorAspectAvailable: true,
    directorSnapshotAvailable: true,
    directorAutoNarration: false,
    onToggleAutoNarration: vi.fn(),
    motionPrompt: '',
    onChangePrompt: vi.fn(),
    onSubmitPrompt: vi.fn(),
    promptHistory: [],
    promptAspectRatio: '16:9' as const,
    onChangeAspectRatio: vi.fn(),
    promptImages: [],
    onAttachImages: vi.fn(),
    onRemoveImage: vi.fn(),
    promptAudio: null,
    onAttachAudio: vi.fn(),
    onRemoveAudio: vi.fn(),
    promptAudioGain: 1,
    onChangeAudioGain: vi.fn(),
    promptAudioLoop: true,
    onToggleAudioLoop: vi.fn(),
    promptVoiceover: '',
    onChangeVoiceover: vi.fn(),
    promptVoiceoverGain: 1,
    onChangeVoiceoverGain: vi.fn(),
    quality: {
      passed: true,
      samples: [{ frame: 45, scene: 0, visibleHeadlines: ['Headline'] }],
      issues: [{ severity: 'warning' as const, code: 'low-contrast-subtitle', scene: 0, message: 'Hard to read' }],
    },
    captionsAvailable: true,
    onExportCaptions: vi.fn(),
    visionRepairAvailable: true,
    onRepairVision: vi.fn(),
    visionAvailable: true,
    onReviewVision: vi.fn(),
    visionReview: null,
    onPrepareSuggestedRevision: vi.fn(),
    motionSnapshots: [],
    onLoadDirectorSnapshots: vi.fn(),
  };

  it('renders prompt input and handles changes and submit', () => {
    const onChangePrompt = vi.fn();
    const onSubmitPrompt = vi.fn();

    render(
      <StudioQuickDirectPanel
        {...defaultProps}
        motionPrompt="Create teaser clip"
        onChangePrompt={onChangePrompt}
        onSubmitPrompt={onSubmitPrompt}
      />
    );

    const input = screen.getByLabelText('Studio prompt');
    expect(input).toHaveValue('Create teaser clip');

    fireEvent.change(input, { target: { value: 'Revise teaser clip' } });
    expect(onChangePrompt).toHaveBeenCalledWith('Revise teaser clip');

    const submitBtn = screen.getByRole('button', { name: /Revise with AI/i });
    fireEvent.click(submitBtn);
    expect(onSubmitPrompt).toHaveBeenCalled();
  });

  it('displays quality check summary accordion and handles vision repair', () => {
    const onRepairVision = vi.fn();

    render(
      <StudioQuickDirectPanel
        {...defaultProps}
        onRepairVision={onRepairVision}
      />
    );

    const qualitySummary = screen.getByText(/Quality checks · Structure OK/i);
    expect(qualitySummary).toBeInTheDocument();

    fireEvent.click(qualitySummary);
    expect(screen.getByText(/low-contrast-subtitle/i)).toBeInTheDocument();

    const repairBtn = screen.getByRole('button', { name: 'Review & auto-improve once' });
    fireEvent.click(repairBtn);
    expect(onRepairVision).toHaveBeenCalled();
  });

  it('triggers onReviewVision when review button is clicked', () => {
    const onReviewVision = vi.fn();

    render(
      <StudioQuickDirectPanel
        {...defaultProps}
        onReviewVision={onReviewVision}
      />
    );

    fireEvent.click(screen.getByText(/Quality checks · Structure OK/i));
    const reviewBtn = screen.getByRole('button', { name: 'AI Vision Review (uses configured model)' });
    fireEvent.click(reviewBtn);
    expect(onReviewVision).toHaveBeenCalled();
  });

  it('displays vision review findings and prepares suggested revision', () => {
    const onPrepareSuggestedRevision = vi.fn();

    render(
      <StudioQuickDirectPanel
        {...defaultProps}
        visionReview={{
          type: 'model-vision-sampled-frames',
          projectId: 'proj-1',
          revision: 1,
          reviewedFrames: [45],
          passed: false,
          issues: [{
            frame: 45,
            category: 'readability',
            severity: 'error',
            explanation: 'Headline too small',
            suggestion: 'Move headline to safe canvas region',
          }],
          limitations: ['Sampled frame only'],
        }}
        onPrepareSuggestedRevision={onPrepareSuggestedRevision}
      />
    );

    fireEvent.click(screen.getByText(/Quality checks · Structure OK/i));
    expect(screen.getByText('Headline too small')).toBeInTheDocument();

    const prepareBtn = screen.getByRole('button', { name: 'Prepare suggested revision' });
    fireEvent.click(prepareBtn);
    expect(onPrepareSuggestedRevision).toHaveBeenCalledWith(
      'Improve the current motion at frame 45 for readability: Move headline to safe canvas region'
    );
  });

  it('renders snapshot samples when available', () => {
    render(
      <StudioQuickDirectPanel
        {...defaultProps}
        motionSnapshots={[{ frame: 45, url: 'blob:sample-45' }]}
      />
    );

    fireEvent.click(screen.getByText(/Quality checks · Structure OK/i));
    expect(screen.getByAltText('Rendered frame 45')).toHaveAttribute('src', 'blob:sample-45');
  });

  it('disables director controls when directorAvailable is false', () => {
    render(
      <StudioQuickDirectPanel
        {...defaultProps}
        directorAvailable={false}
      />
    );

    expect(screen.getByText(/AI Studio Director needs an updated SuperAgent server/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Revise with AI/i })).toBeDisabled();
  });
});
