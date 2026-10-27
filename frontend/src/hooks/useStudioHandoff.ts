import { useEffect } from 'react';
import { studioControlChannel } from '../services/studioControlChannel';
import type { WorkspaceInfo } from './useTerminals';

interface StudioHandoffOptions {
  workspaces: WorkspaceInfo[];
  panelWorkspace: WorkspaceInfo | null;
  openStudioTab: (workspaceId?: string) => void;
}

/**
 * Listens for typed desktop studio actions from the Assistant or tools
 * and focuses the Studio tab and project in the target workspace.
 */
export function useStudioHandoff({
  workspaces,
  panelWorkspace,
  openStudioTab,
}: StudioHandoffOptions): void {
  useEffect(() => {
    return studioControlChannel.onAction(action => {
      if (!action) return;

      // Find the target workspace matching action.workspacePath
      let targetWs: WorkspaceInfo | undefined;
      if (action.workspacePath) {
        const normActionPath = action.workspacePath.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
        targetWs = workspaces.find(w => {
          const normWsPath = w.path.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
          return normWsPath === normActionPath;
        });
      }

      // Fall back to panelWorkspace if no exact path matched
      if (!targetWs && panelWorkspace) {
        targetWs = panelWorkspace;
      }

      // If workspace resolved, open/focus the Studio tab
      if (targetWs) {
        openStudioTab(targetWs.id);
      }
    });
  }, [workspaces, panelWorkspace, openStudioTab]);
}
