/**
 * Opt-in Core API port for T-Line's loopback-only backend.
 * Defaults to the established 7888 endpoint. Never accept a URL/hostname:
 * callers must always connect to 127.0.0.1 using a port-scoped private bearer.
 *
 * Changing the port does NOT migrate in-memory agent sessions or OAuth MCP
 * transports. Use only after a separately verified supervised Core exists.
 */
export const DEFAULT_SUPERAGENT_CORE_PORT = 7888;

export function resolveSuperAgentCorePort(raw=process.env.TLINE_SUPERAGENT_CORE_PORT):number {
  if(raw===undefined || raw.trim()==="")return DEFAULT_SUPERAGENT_CORE_PORT;
  if(!/^[0-9]{4,5}$/.test(raw) || Number(raw)<1024 || Number(raw)>65535)
    throw new Error("Invalid TLINE_SUPERAGENT_CORE_PORT; expected loopback TCP port 1024-65535");
  return Number(raw);
}
