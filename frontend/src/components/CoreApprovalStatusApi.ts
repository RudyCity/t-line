export type CoreApprovalState = 'pending' | 'approved' | 'approved_session' | 'denied' | 'expired' | 'cancelled';
export type CoreApprovalSummary = {
  permissionId: string; state: CoreApprovalState;
  requestedAt: number; updatedAt: number; expiresAt: number;
};
const states = new Set(['pending','approved','approved_session','denied','expired','cancelled']);
export async function listCoreApprovals(workspace: string, sessionId: string,
  auth: () => Record<string,string>, signal?: AbortSignal): Promise<CoreApprovalSummary[]> {
  const params = new URLSearchParams({ workspace, sessionId });
  const response = await fetch('/api/superagent/assistant/approvals?' + params, {
    headers: auth(), cache: 'no-store', signal,
  });
  const data = await response.json();
  if (!response.ok || data?.success !== true || data?.sessionId !== sessionId ||
      !Array.isArray(data?.approvals) || data.approvals.length > 40 ||
      data.approvals.some((item: any) =>
        !item || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.permissionId) || !states.has(item.state) ||
        ![item.requestedAt,item.updatedAt,item.expiresAt].every(n =>
          Number.isSafeInteger(n) && n > 0))) {
    throw Error('Core approval status unavailable or invalid');
  }
  return data.approvals;
}
