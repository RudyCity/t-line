export type AssistantChatTurn = {
  turnId: string;
  state: 'accepted' | 'queued' | 'recoverable' | 'running' |
    'completed' | 'failed' | 'cancelled' | 'interrupted';
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};
const endpoint = '/api/superagent/assistant/turns';

export async function loadAssistantTurns(workspace: string, sessionId: string,
  authorization: () => Record<string, string>, signal?: AbortSignal):
  Promise<AssistantChatTurn[]> {
  const query = new URLSearchParams({ workspace, sessionId }).toString();
  const res = await fetch(endpoint + '?' + query, {
    headers: authorization(), cache: 'no-store', signal,
  });
  const data = await res.json();
  if (!res.ok || data.success !== true || data.sessionId !== sessionId || !Array.isArray(data.turns)) {
    throw Error(data.error || 'Assistant queue unavailable');
  }
  return data.turns as AssistantChatTurn[];
}

export async function resumeAssistantTurns(workspace: string, sessionId: string,
  authorization: () => Record<string, string>): Promise<number> {
  const query = new URLSearchParams({ workspace, sessionId }).toString();
  const res = await fetch(endpoint + '/recover?' + query, {
    method: 'POST', headers: authorization(), cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok || data.success !== true || data.sessionId !== sessionId) {
    throw Error(data.error || 'Unable to recover queued turns');
  }
  return data.resumed as number;
}

/** When the agent is busy, additional text is queued by Core, not started concurrently
 * against the same conversation context. A separate session runs independently. */
export const assistantTurnTotals = (turns: readonly AssistantChatTurn[]) => ({
  pending: turns.filter(t => t.state === 'queued' || t.state === 'accepted').length,
  running: turns.filter(t => t.state === 'running').length,
  recoverable: turns.filter(t => t.state === 'recoverable').length,
});
