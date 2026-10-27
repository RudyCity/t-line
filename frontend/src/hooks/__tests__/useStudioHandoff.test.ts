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
        panelWorkspace: mockWorkspaces[0],
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

  it('falls back to panelWorkspace when workspacePath does not match a known workspace', () => {
    const openStudioTab = vi.fn();
    renderHook(() =>
      useStudioHandoff({
        workspaces: mockWorkspaces,
        panelWorkspace: mockWorkspaces[0],
        openStudioTab,
      })
    );

    studioControlChannel.emitAction({
      type: 'focus_studio',
      workspacePath: 'D:\\other\\unmatched',
    });

    expect(openStudioTab).toHaveBeenCalledWith('ws-1');
  });
});
