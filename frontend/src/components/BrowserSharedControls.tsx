import { useState } from 'react';
import { UserPlus, UserX, ArrowRightLeft, LockKeyhole, Copy } from 'lucide-react';

export type SharedBrowserSession = {
  key: string; port: number; targetId: string; agentId: string;
  mode?: 'shared' | 'isolated';
  participants?: Array<{ agentId: string; role: 'owner' | 'observer' | 'contributor' }>;
};
type Action = 'share' | 'stop' | 'invite' | 'revoke' | 'handover' | 'participants';

/** Controls are disabled until a human explicitly supplies the owner capability.
 * The token lives only in this React component, never in storage or query strings. */
export default function BrowserSharedControls({
  session, onChanged,
}: { session: SharedBrowserSession; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [ownerToken, setOwnerToken] = useState('');
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState<'observer' | 'contributor'>('observer');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ inviteId: string; invitationToken: string; agentId: string } | null>(null);
  const [message, setMessage] = useState('');
  async function act(action: Action, member = memberId) {
    if (!ownerToken || pending) return;
    if (action === 'handover' && !window.confirm('Transfer tab ownership to ' + member + '? Your owner token will be revoked.')) return;
    if (action === 'stop' && !window.confirm('Disable shared mode and revoke every participant?')) return;
    setPending(true); setError(''); setResult(null); setMessage('');
    try {
      const response = await fetch('/api/superagent/browser/shared-control', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, port: session.port, targetId: session.targetId, agentId: session.agentId,
          sessionToken: ownerToken, memberId: member, role,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Action not authorized');
      if (action === 'invite') {
        const invite = data.result;
        if (!invite?.inviteId || !invite?.invitationToken) throw new Error('Invalid invitation response');
        setResult({ inviteId: invite.inviteId, invitationToken: invite.invitationToken, agentId: invite.agentId });
      } else {
        setMessage(action === 'participants' ? 'Participants refreshed' : 'Action completed');
      }
      if (action === 'handover' || action === 'stop') setOwnerToken('');
      if (action !== 'participants') onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to manage session'); }
    finally { setPending(false); }
  }
  const close = () => { setExpanded(false); setOwnerToken(''); setResult(null); setError(''); setMessage(''); };
  return (
    <div className="mt-1 text-[11px]">
      <button type="button" aria-label={'Manage shared tab ' + session.targetId}
        className="rounded px-1.5 py-1 hover:bg-[var(--bg-main)] text-[var(--text-muted)]"
        onClick={() => expanded ? close() : setExpanded(true)}>
        <LockKeyhole size={12} className="inline mr-1"/> {expanded ? 'Close controls' : 'Manage sharing'}
      </button>
      {expanded && (
        <div className="mt-1 space-y-2 rounded border border-[var(--border-color)] p-2">
          <label className="block">
            Owner session token (not saved)
            <input type="password" aria-label={'Owner token ' + session.targetId}
              autoComplete="off" value={ownerToken} onChange={e => setOwnerToken(e.target.value)}
              className="mt-1 w-full min-w-0 rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-1"
              placeholder="Paste owner session token" />
          </label>
          <div className="flex flex-wrap items-center gap-1">
            <button disabled={!ownerToken || pending} type="button" onClick={() => void act(session.mode === 'shared' ? 'stop' : 'share')}
              className="rounded border border-[var(--border-color)] px-2 py-1 disabled:opacity-50">
              {session.mode === 'shared' ? 'Stop sharing' : 'Enable sharing'}
            </button>
            <button disabled={!ownerToken || pending} type="button" onClick={() => void act('participants')}
              className="rounded border border-[var(--border-color)] px-2 py-1 disabled:opacity-50">Refresh</button>
          </div>
          {session.mode === 'shared' && (
            <>
              <label className="block">
                Invite named agent
                <input aria-label="New participant agent ID" value={memberId}
                  onChange={e => setMemberId(e.target.value)} autoComplete="off"
                  placeholder="agent-id" className="mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-1" />
              </label>
              <div className="flex gap-1 items-center">
                <select aria-label="New participant role" value={role} onChange={e => setRole(e.target.value as 'observer' | 'contributor')}
                  className="min-w-0 flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-1">
                  <option value="observer">Observer</option><option value="contributor">Contributor</option>
                </select>
                <button type="button" disabled={!ownerToken || !memberId || pending} onClick={() => void act('invite')}
                  className="rounded border border-[var(--border-color)] px-2 py-1 disabled:opacity-50"
                ><UserPlus size={12} className="inline mr-1"/>Invite</button>
              </div>
              {session.participants?.filter(p => p.role !== 'owner').map(member => (
                <div className="flex items-center justify-between gap-1" key={member.agentId}>
                  <span className="min-w-0 truncate" title={member.agentId}>{member.agentId} · {member.role}</span>
                  <span className="flex shrink-0 gap-1">
                    <button type="button" disabled={!ownerToken || pending} title="Revoke agent"
                      aria-label={'Revoke ' + member.agentId} onClick={() => void act('revoke', member.agentId)}>
                      <UserX size={13}/>
                    </button>
                    {member.role === 'contributor' && <button type="button" disabled={!ownerToken || pending}
                      title="Transfer ownership" aria-label={'Handover to ' + member.agentId}
                      onClick={() => void act('handover', member.agentId)}><ArrowRightLeft size={13}/></button>}
                  </span>
                </div>
              ))}
            </>
          )}
          {result && (
            <div className="rounded border border-[var(--border-color)] p-1.5">
              <div className="font-semibold">One-time invitation for {result.agentId}</div>
              <p className="text-[10px] text-[var(--text-muted)]">Copy now. Secret disappears when controls close.</p>
              <button type="button" className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1"
                onClick={() => void navigator.clipboard.writeText(JSON.stringify({
                  inviteId: result.inviteId, invitationToken: result.invitationToken, agentId: result.agentId, targetId: session.targetId,
                }))}><Copy size={12}/> Copy invitation</button>
            </div>
          )}
          {error && <p role="alert" className="text-red-400">{error}</p>}
          {message && <p role="status" className="text-[var(--text-muted)]">{message}</p>}
        </div>
      )}
    </div>
  );
}
