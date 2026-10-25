/** Pairing is a deliberate user-initiated handoff to SuperAgent's existing MCP gateway.
 * Browser CDP ports are NOT bearer credentials, and never travel to remote APIs.
 * The native supervisor verifies ownership and target generation before minting data.
 */
export type ManagedBrowserGatewayPairing = {
  profileId: string;
  generation: string;
  targetId: string;
  port: number;
  transport: 'superagent_browser_gateway';
};
export function gatewayPairingInstructions(input: ManagedBrowserGatewayPairing): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(input.profileId)
    || !/^[a-z0-9-]{1,96}$/i.test(input.generation)
    || !/^[A-Za-z0-9_-]{1,128}$/.test(input.targetId)
    || !Number.isInteger(input.port) || input.port < 1024 || input.port > 65535
    || input.transport !== 'superagent_browser_gateway') {
    throw new Error('Invalid verified browser pairing response');
  }
  return [
    'Connect to my T-Line managed browser via the existing SuperAgent MCP browser gateway.',
    'The native desktop confirmed this target belongs to the active managed browser generation.',
    'First check superagent_browser_gateway action=managed for the local Core runtime registration; it does not grant access.',
    'Use superagent_browser_gateway with action=discover, port=' + input.port,
    'Then use action=claim, port=' + input.port + ', targetId=' + input.targetId + '.',
    'Do not control other targets or ports. Use an explicit agent claim and respect session ownership.',
    'If the target is claimed by someone else, request approved shared access instead of taking over.',
    'Selected profile: ' + input.profileId + '. Generation: ' + input.generation + '.',
    'This descriptor contains no session tokens. Stop if the browser runtime has restarted.',
  ].join('\n');
}
