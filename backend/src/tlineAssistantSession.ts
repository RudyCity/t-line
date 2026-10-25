/** Pin each websocket to the exact conversation it was opened for.
 * Never forward a renderer-supplied session ID into another core session. */
export function isBoundAssistantSession(connectionSessionId: string | undefined,
  requestedSessionId: unknown): requestedSessionId is string {
  return typeof connectionSessionId === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(connectionSessionId) &&
    typeof requestedSessionId === 'string' &&
    requestedSessionId === connectionSessionId;
}
export function validAssistantTurnId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
