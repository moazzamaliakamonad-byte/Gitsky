/**
 * The optional personal access token lives in sessionStorage only: it disappears
 * when the tab closes, is never written to disk by us, and is only ever sent as an
 * Authorization header to api.github.com (enforced in github.ts).
 */
const KEY = 'gitsky:token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token.trim());
  } catch {
    // Storage blocked: the token simply won't persist across reloads.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
