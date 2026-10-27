// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SuperAgentToolItem } from '../SuperAgentToolItem';
import { studioControlChannel } from '../../services/studioControlChannel';

describe('SuperAgentToolItem - Studio Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

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
    expect(screen.getByText('Studio Edit')).toBeDefined();

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: /Show Studio Edit tool details/i }));

    // Should show receipt summary and revision bump
    expect(screen.getByText('rev 1 → 2')).toBeDefined();
    expect(screen.getByText('Added headline text overlay')).toBeDefined();
    expect(screen.getByText('layer-text-1')).toBeDefined();

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

  it('maps studioId when projectId is omitted and supports dispatched delivery', () => {
    const emitSpy = vi.spyOn(studioControlChannel, 'emitAction');

    const msg = {
      role: 'tool' as const,
      text: 'Desktop focus dispatched',
      toolName: 'studio_desktop_focus',
      args: {
        studioId: 'proj-video-2',
        workspacePath: 'D:/workspaces/demo',
      },
      result: {
        success: true,
        delivery: 'dispatched',
        studioId: 'proj-video-2',
        action: {
          type: 'open_project',
          workspacePath: 'D:/workspaces/demo',
          projectId: 'proj-video-2',
        },
      },
    };

    render(<SuperAgentToolItem msg={msg} />);
    fireEvent.click(screen.getByRole('button', { name: /Show Studio Focus tool details/i }));

    expect(screen.getByText('dispatched')).toBeDefined();

    const focusBtn = screen.getByRole('button', { name: /Focus in Studio/i });
    fireEvent.click(focusBtn);

    expect(emitSpy).toHaveBeenCalledWith({
      type: 'open_project',
      workspacePath: 'D:/workspaces/demo',
      projectId: 'proj-video-2',
    });
  });

  it('safely ignores string action payloads and does not emit invalid actions', () => {
    const emitSpy = vi.spyOn(studioControlChannel, 'emitAction');

    const msg = {
      role: 'tool' as const,
      text: 'Malformed action test',
      toolName: 'studio_desktop_focus',
      args: {
        action: 'studio_control_action', // Malformed string
      },
      result: { success: true },
    };

    render(<SuperAgentToolItem msg={msg} />);
    fireEvent.click(screen.getByRole('button', { name: /Show Studio Focus tool details/i }));

    // Apply View Navigation button should not be rendered for string actions
    expect(screen.queryByRole('button', { name: /Apply View Navigation/i })).toBeNull();
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
    expect(screen.getByText('Studio Focus')).toBeDefined();

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
