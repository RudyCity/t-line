export const TOKEN_KEY = 'token';
export const TLINE_TOKEN_KEY = 'tline-token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token =
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(TLINE_TOKEN_KEY);
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    return null;
  }
  return token;
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TLINE_TOKEN_KEY, token);
  } catch (e) {
    console.warn('Failed to persist auth token:', e);
  }
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TLINE_TOKEN_KEY);
  } catch (e) {
    console.warn('Failed to clear auth token:', e);
  }
}
