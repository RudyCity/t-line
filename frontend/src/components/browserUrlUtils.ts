export type RenderMode = 'tauri-native' | 'electron-webview' | 'iframe-local' | 'external-fallback';

export const isLocalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname.startsWith('192.168.')
      || parsed.hostname.endsWith('.local')
      || parsed.protocol === 'file:';
  } catch {
    return false;
  }
};

export const determineRenderMode = (
  url: string,
  isTauri: boolean,
  isElectron: boolean
): RenderMode => {
  if (!url) {
    return 'external-fallback';
  }

  const local = isLocalUrl(url);
  if (isTauri) {
    return 'tauri-native';
  }
  if (isElectron) {
    return 'electron-webview';
  }
  if (local) {
    return 'iframe-local';
  }
  return 'external-fallback';
};
