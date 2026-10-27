import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuperAgentToolItem } from '../SuperAgentToolItem';
import { studioControlChannel } from '../../services/studioControlChannel';

describe('SuperAgentToolItem - Studio Integration', () => {
  it('renders Studio Edit tool with receipt details and focus button', () => {
    const emitSpy = vi.spyOn(studioControlChannel, 'emitAction');

    const msg = {
      role: 'tool' as const,
      text: 'Project updated',
      toolName: 'studio_edit_project',
      args: {
        workspacePath: 'D:/workspaces/demo',
        projectId: 'proj-video-1',
        operation: 'add_text_layer',
      },
      result: {
        success: true,
        receipt: {
          operationId: 'op-001',
          timestamp: '2026-10-27T00:00:00Z',
          actor: 'assistant' as const,
          projectId: 'proj-video-1',
          projectName: 'Hero Promo',
          revisionBefore: 1,
          revisionAfter: 2,
          summary: 'Added headline text overlay',
          affectedEntities: { layers: ['layer-text-1'] },
          reversible: true,
        },
      },
    };

    render(<SuperAgentToolItem msg={msg} />);

    // Header line should show Studio Edit
    expect(screen.getByText('Studio Edit')).toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: /Show Studio Edit tool details/i }));

    // Should show receipt summary and revision bump
    expect(screen.getByText('rev 1 → 2')).toBeInTheDocument();
    expect(screen.getByText('Added headline text overlay')).toBeInTheDocument();
    expect(screen.getByText('layer-text-1')).toBeInTheDocument();

    // Click Focus in Studio
    const focusBtn = screen.getByRole('button', { name: /Focus in Studio/i });
    fireEvent.click(focusBtn);

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open_project',
        workspacePath: 'D:/workspaces/demo',
        projectId: 'proj-video-1',
      })
    );
  });

  it('renders Studio Focus tool and applies view navigation', () => {
    const emitSpy = vi.spyOn(studioControlChannel, 'emitAction');

    const msg = {
      role: 'tool' as const,
      text: 'Focus applied',
      toolName: 'studio_desktop_focus',
      args: {
        action: {
          type: 'seek_timecode',
          workspacePath: 'D:/workspaces/demo',
          projectId: 'proj-video-1',
          timeSeconds: 5.5,
        },
      },
      result: { success: true },
    };

    render(<SuperAgentToolItem msg={msg} />);
    expect(screen.getByText('Studio Focus')).toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByRole('button', { name: /Show Studio Focus tool details/i }));

    const navBtn = screen.getByRole('button', { name: /Apply View Navigation/i });
    fireEvent.click(navBtn);

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'seek_timecode',
        timeSeconds: 5.5,
      })
    );
  });
});
