/** Native-verified managed-browser handoffs stay inside the selected workspace.
 * This helper does not authenticate a CDP target; Rust's owner/generation check
 * must complete before the UI is allowed to call it. */
export function browserHandoffWorkspace(
  workspaceId: string | undefined,
  instruction: string,
  workspaces: Array<{ id: string; path: string }>,
): string | null {
  if (!workspaceId || !instruction || instruction.length > 2000 ||
      !instruction.includes('superagent_browser_gateway') ||
      !instruction.includes('action=claim, port=')) return null;
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (!workspace?.path || !workspace.path.trim()) return null;
  return workspace.path;
}

/** Agent handoff instructions are ephemeral; never silently deliver stale
 * browser targets to a newly selected session after long reconnects. */
export function isFreshBrowserHandoff(createdAt: number, now = Date.now()): boolean {
  return Number.isFinite(createdAt) && createdAt <= now &&
    now - createdAt <= 60_000;
}
