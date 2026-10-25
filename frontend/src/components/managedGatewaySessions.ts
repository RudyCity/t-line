import type { ManagedBrowserGatewayPairing } from './managedBrowserGateway';

export type GatewayClaimProjection = {
  port: number;
  targetId: string;
  agentId: string;
  mode: 'isolated' | 'shared';
  expiresAt: number;
  participants?: Array<{ agentId: string; role: 'owner' | 'observer' | 'contributor' }>;
};
/** Read-only dashboard projection. An existing claim does not prove that an
 * agent is executing, and a port/target match is not an authentication token. */
export function matchingGatewayClaim(
  pairing: ManagedBrowserGatewayPairing,
  snapshot: unknown,
  now = Date.now(),
): GatewayClaimProjection | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const sessions = (snapshot as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessions)) return null;
  const match = sessions.find((row: any) => row && row.port === pairing.port
    && row.targetId === pairing.targetId && row.expiresAt > now
    && typeof row.agentId === 'string'
    && (row.mode === 'shared' || row.mode === 'isolated'));
  if (!match) return null;
  return {
    port: pairing.port, targetId: pairing.targetId,
    agentId: match.agentId, mode: match.mode, expiresAt: match.expiresAt,
    participants: Array.isArray(match.participants)
      ? match.participants.filter((p: any) => p &&
        typeof p.agentId === 'string' &&
        (p.role === 'owner' || p.role === 'observer' || p.role === 'contributor'))
          .slice(0, 12).map((p: any) => ({ agentId: p.agentId, role: p.role }))
      : [],
  };
}
