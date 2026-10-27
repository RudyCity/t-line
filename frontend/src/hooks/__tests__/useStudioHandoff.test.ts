// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStudioHandoff } from '../useStudioHandoff';
import { studioControlChannel } from '../../services/studioControlChannel';
import type { WorkspaceInfo } from '../useTerminals';

describe('useStudioHandoff', () => {
  const mockWorkspaces: WorkspaceInfo[] = [
    { id: 'ws-1', name: 'App One', path: 'C:/projects/app-one' } as WorkspaceInfo,
    { id: 'ws-2', name: 'Video Proj', path: 'D:/media/video-proj' } as WorkspaceInfo,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches to target workspace studio tab when action matches workspace path', () => {
    const openStudioTab = vi.fn();
    renderHook(() =>
      useStudioHandoff({
        workspaces: mockWorkspaces,
        openStudioTab,
      })
    );

    studioControlChannel.emitAction({
      type: 'open_project',
      workspacePath: 'D:\\media\\video-proj',
      projectId: 'proj-123',
    });

    expect(openStudioTab).toHaveBeenCalledWith('ws-2');
  });

  it('fails closed and rejects unmatched explicit workspacePath without fallback', () => {
    const openStudioTab = vi.fn();
    renderHook(() =>
      useStudioHandoff({
        workspaces: mockWorkspaces,
        openStudioTab,
      })
    );

    studioControlChannel.emitAction({
      type: 'focus_studio',
      workspacePath: 'D:\\other\\unmatched',
    });

    // AUD-03: Must NOT redirect to any workspace
    expect(openStudioTab).not.toHaveBeenCalled();
  });
});
