export type AgentChatMode = 'single' | 'multi';

/**
 * Modes belong to individual sessions. A mode switch must never repurpose
 * or abort a different session/agent already running in the shared core.
 */
export function resolveAgentChatModeSwitch(current: AgentChatMode, requested: AgentChatMode) {
  return { mode: requested, createSession: requested !== current } as const;
}
