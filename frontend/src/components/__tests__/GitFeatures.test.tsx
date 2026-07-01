import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileExplorer } from '../FileExplorer';
import { GitChanges, GitFileStatus } from '../GitChanges';

describe('FileExplorer - Git Status Badges', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders root items and shows correct badges and directory changes count', async () => {
    const rootPath = 'D:/workspace';
    const token = 'mock-token';
    const changedFiles: GitFileStatus[] = [
      { path: 'src/App.tsx', status: 'modified', staged: false, unstaged: true },
      { path: 'src/components/NewComponent.tsx', status: 'untracked', staged: false, unstaged: true },
      { path: 'deleted-file.txt', status: 'deleted', staged: true, unstaged: false }
    ];

    // Mock fetch for explore directories
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/fs/explore')) {
        if (urlStr.includes('path=D%3A%2Fworkspace%2Fsrc%2Fcomponents')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              contents: [
                { name: 'NewComponent.tsx', path: 'D:/workspace/src/components/NewComponent.tsx', isDirectory: false }
              ]
            })
          } as Response);
        }
        if (urlStr.includes('path=D%3A%2Fworkspace%2Fsrc')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              contents: [
                { name: 'App.tsx', path: 'D:/workspace/src/App.tsx', isDirectory: false },
                { name: 'components', path: 'D:/workspace/src/components', isDirectory: true }
              ]
            })
          } as Response);
        }
        // Root path
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            contents: [
              { name: 'src', path: 'D:/workspace/src', isDirectory: true },
              { name: 'package.json', path: 'D:/workspace/package.json', isDirectory: false }
            ]
          })
        } as Response);
      }
      return Promise.reject(new Error('Unknown url: ' + urlStr));
    });

    render(
      <FileExplorer
        rootPath={rootPath}
        token={token}
        changedFiles={changedFiles}
        onRefresh={() => {}}
      />
    );

    // Verify it calls explore for the root path
    expect(fetchSpy).toHaveBeenCalledWith('/api/fs/explore?path=D%3A%2Fworkspace', expect.any(Object));

    // Wait for the root items to render
    const srcFolder = await screen.findByText('src');
    expect(srcFolder).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();

    // The 'src' folder should display the count of changed files inside it (2: App.tsx and NewComponent.tsx)
    const folderChangesCount = screen.getByTitle('2 changed file(s) inside');
    expect(folderChangesCount).toBeInTheDocument();
    expect(folderChangesCount.textContent).toBe('2');

    // Click 'src' to expand it
    fireEvent.click(srcFolder);

    // Verify it calls fetch for the expanded directory
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/fs/explore?path=D%3A%2Fworkspace%2Fsrc', expect.any(Object));
    });

    // App.tsx and components folder should now be visible
    const appFile = await screen.findByText('App.tsx');
    expect(appFile).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();

    // App.tsx should have the Modified badge 'M'
    const modifiedBadge = screen.getByText('M');
    expect(modifiedBadge).toBeInTheDocument();
    expect(modifiedBadge.style.color).toBe('rgb(251, 191, 36)'); // #fbbf24 in rgb
  });
});

describe('GitChanges - Tabs and File Actions', () => {
  const workspaceId = 'ws-123';
  const token = 'mock-token';
  const mockFiles: GitFileStatus[] = [
    { path: 'src/App.tsx', status: 'modified', staged: false, unstaged: true },
    { path: 'package.json', status: 'modified', staged: true, unstaged: false },
    { path: 'src/components/NewComponent.tsx', status: 'untracked', staged: false, unstaged: true }
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders staged and unstaged files correctly', () => {
    render(
      <GitChanges
        workspaceId={workspaceId}
        token={token}
        files={mockFiles}
        loading={false}
        onRefresh={() => {}}
      />
    );

    // Verify section headers
    expect(screen.getByText('Staged Changes (1)')).toBeInTheDocument();
    expect(screen.getByText('Changes (2)')).toBeInTheDocument();

    // Verify file names are present
    expect(screen.getByText('package.json')).toBeInTheDocument();
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getByText('NewComponent.tsx')).toBeInTheDocument();

    // Verify status labels
    const mLabels = screen.getAllByText('M');
    expect(mLabels.length).toBe(2); // staged package.json and unstaged App.tsx
    expect(screen.getByText('U')).toBeInTheDocument(); // NewComponent.tsx
  });

  it('calls stage API when clicking plus button on unstaged file', async () => {
    const onRefresh = vi.fn();
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true } as Response)
    );

    render(
      <GitChanges
        workspaceId={workspaceId}
        token={token}
        files={mockFiles}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    // Find the stage button for App.tsx (unstaged)
    const stageButtons = screen.getAllByTitle('Stage Changes');
    // The first unstaged is App.tsx, which has a stage button
    fireEvent.click(stageButtons[0]);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/git/stage`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }),
        body: JSON.stringify({ filePath: 'src/App.tsx', all: false, worktreePath: undefined })
      })
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('calls unstage API when clicking minus button on staged file', async () => {
    const onRefresh = vi.fn();
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true } as Response)
    );

    render(
      <GitChanges
        workspaceId={workspaceId}
        token={token}
        files={mockFiles}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    // Find the unstage button for package.json (staged)
    const unstageButton = screen.getByTitle('Unstage Changes');
    fireEvent.click(unstageButton);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/git/unstage`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }),
        body: JSON.stringify({ filePath: 'package.json', all: false, worktreePath: undefined })
      })
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('calls discard API when clicking discard button and user confirms', async () => {
    const onRefresh = vi.fn();
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true } as Response)
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(
      <GitChanges
        workspaceId={workspaceId}
        token={token}
        files={mockFiles}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    // Find the discard button for App.tsx (first unstaged file with a discard changes button)
    const discardButtons = screen.getAllByTitle('Discard Changes');
    fireEvent.click(discardButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to discard changes in src/App.tsx?')
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/git/discard`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }),
        body: JSON.stringify({ filePath: 'src/App.tsx', all: false, worktreePath: undefined })
      })
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it('calls commit API when typing message and clicking commit button', async () => {
    const onRefresh = vi.fn();
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() =>
      Promise.resolve({ ok: true } as Response)
    );

    render(
      <GitChanges
        workspaceId={workspaceId}
        token={token}
        files={mockFiles}
        loading={false}
        onRefresh={onRefresh}
      />
    );

    // Type a commit message
    const textarea = screen.getByPlaceholderText('Commit message (Ctrl+Enter to commit...)');
    fireEvent.change(textarea, { target: { value: 'feat: add awesome feature' } });

    // Enable "Stage all & commit" checkbox
    const checkbox = screen.getByLabelText('Stage all & commit');
    fireEvent.click(checkbox);

    // Click commit button
    const commitBtn = screen.getByRole('button', { name: 'Commit' });
    fireEvent.click(commitBtn);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/git/commit`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }),
        body: JSON.stringify({ message: 'feat: add awesome feature', commitAll: true, worktreePath: undefined })
      })
    );

    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled();
      expect(textarea.textContent).toBe('');
    });
  });
});
