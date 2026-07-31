export function logUI(message: string, meta?: any): void {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[TLINE-UI] [${timestamp}] ${message}`, meta || '');
    fetch('/api/superagent/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'TLINE-UI', message, meta })
    }).catch(() => {});
  } catch {}
}
