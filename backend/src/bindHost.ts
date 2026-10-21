/**
 * The desktop backend is a privileged local control plane (PTY, workspace FS,
 * SuperAgent bridge). Never expose it on LAN interfaces by accident.
 * A remote bind requires two explicit opt-in settings.
 */
export function resolveBackendBindHost(env: {
  TLINE_BIND_HOST?: string;
  TLINE_ALLOW_REMOTE_BIND?: string;
}): string {
  const host = env.TLINE_BIND_HOST?.trim() || '127.0.0.1';
  if (['localhost', '127.0.0.1', '::1'].includes(host)) return host;
  if (env.TLINE_ALLOW_REMOTE_BIND !== '1') {
    throw new Error('Refusing non-loopback T-Line bind host; explicitly set TLINE_ALLOW_REMOTE_BIND=1');
  }
  return host;
}
