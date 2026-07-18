import { lazy } from 'react';

export const LazyWorkspaceAddModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.WorkspaceAddModal }))
);

export const LazyWorktreeAddModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.WorktreeAddModal }))
);

export const LazyTunnelSetupModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.TunnelSetupModal }))
);

export const LazySettingsModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.SettingsModal }))
);

export const LazyShortcutHelpModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.ShortcutHelpModal }))
);

export const LazyConfirmModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.ConfirmModal }))
);

export const LazyWorkspaceEditModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.WorkspaceEditModal }))
);

export const LazySavePromptModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.SavePromptModal }))
);

export const LazySelectGridModal = lazy(() =>
  import('./Modals').then((module) => ({ default: module.SelectGridModal }))
);

export const LazyBranchModal = lazy(() =>
  import('./BranchModal').then((module) => ({ default: module.BranchModal }))
);
