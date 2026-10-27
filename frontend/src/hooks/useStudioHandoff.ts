import { useEffect } from 'react';
import { studioControlChannel } from '../services/studioControlChannel';
import type { WorkspaceInfo } from './useTerminals';

interface StudioHandoffOptions {
  workspaces: WorkspaceInfo[];
  panelWorkspace?: WorkspaceInfo | null;
  openStudioTab: (workspaceId?: string) => void;
}

/**
 * Listens for typed desktop studio actions from the Assistant or tools
 * and focuses the Studio tab and project in the target workspace.
 * Fails closed when an explicit workspace path is unknown.
 */
export function useStudioHandoff({
  workspaces,
  openStudioTab,
}: StudioHandoffOptions): void {
  useEffect(() => {
    return studioControlChannel.onAction(action => {
      if (!action || !action.workspacePath) return;

      // Find the target workspace matching action.workspacePath
      const normActionPath = action.workspacePath.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
      const targetWs = workspaces.find(w => {
        const normWsPath = w.path.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
        return normWsPath === normActionPath;
      });

      if (!targetWs) {
        // AUD-03: Fail closed. Explicit workspace target must not fall back to an unrelated workspace.
        console.warn(
          `[StudioHandoff] Rejected action: explicit workspacePath "${action.workspacePath}" does not match any registered workspace.`
        );
        return;
      }

      // If workspace resolved, open/focus the Studio tab
      openStudioTab(targetWs.id);
    });
  }, [workspaces, openStudioTab]);
}
