export type UserRole = 'CUSTOMER' | 'AGENT';

export type AuthenticatedUser = {
  id: number;
  username: string;
  name: string;
  roles: UserRole[];
  platformAdmin?: boolean;
  email?: string;
  emailVerified?: boolean;
};

export type StoredAuthSession = {
  accessToken: string;
  refreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  user: AuthenticatedUser;
};

const ACCESS_TOKEN_KEY = 'bobbuy_access_token';
const REFRESH_TOKEN_KEY = 'bobbuy_refresh_token';
const ACCESS_TOKEN_EXPIRES_AT_KEY = 'bobbuy_access_token_expires_at';
const REFRESH_TOKEN_EXPIRES_AT_KEY = 'bobbuy_refresh_token_expires_at';
const AUTH_USER_KEY = 'bobbuy_auth_user';
const TEST_ROLE_KEY = 'bobbuy_test_role';
const TEST_USER_KEY = 'bobbuy_test_user';
const AUTH_CHANGED_EVENT = 'bobbuy-auth-changed';
const CSRF_TOKEN_COOKIE = 'bobbuy_csrf_token';

export const isLocalAuthOverrideEnabled = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function dispatchAuthChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

function parseStoredUser(value: string | null): AuthenticatedUser | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<AuthenticatedUser>;
    if (
      typeof parsed.id === 'number' &&
      typeof parsed.username === 'string' &&
      typeof parsed.name === 'string' &&
      Array.isArray(parsed.roles) && parsed.roles.length > 0 &&
      parsed.roles.every(role => role === 'CUSTOMER' || role === 'AGENT')
    ) {
      return parsed as AuthenticatedUser;
    }
  } catch {
    // Ignore invalid persisted payloads.
  }
  return null;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return token && token.trim() ? token.trim() : null;
}

export function getStoredAccessTokenExpiresAt(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  return value && value.trim() ? value.trim() : null;
}

export function getStoredRefreshTokenExpiresAt(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.localStorage.getItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  return value && value.trim() ? value.trim() : null;
}

export function getStoredUser(): AuthenticatedUser | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return parseStoredUser(window.localStorage.getItem(AUTH_USER_KEY));
}

export function storeAuthSession(session: StoredAuthSession) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (session.accessTokenExpiresAt && session.accessTokenExpiresAt.trim()) {
    window.localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, session.accessTokenExpiresAt);
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  }
  if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt.trim()) {
    window.localStorage.setItem(REFRESH_TOKEN_EXPIRES_AT_KEY, session.refreshTokenExpiresAt);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  }
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
  dispatchAuthChanged();
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  if (typeof document !== 'undefined') {
    document.cookie = `${CSRF_TOKEN_COOKIE}=; Max-Age=0; Path=/`;
  }
  dispatchAuthChanged();
}

export function getStoredCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const token = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CSRF_TOKEN_COOKIE}=`))
    ?.slice(CSRF_TOKEN_COOKIE.length + 1);
  return token && token.trim() ? decodeURIComponent(token.trim()) : null;
}

export function getTestInjectedRole(): UserRole | null {
  if (typeof window === 'undefined' || !isLocalAuthOverrideEnabled()) {
    return null;
  }
  const injectedRole = window.localStorage.getItem(TEST_ROLE_KEY);
  return injectedRole === 'CUSTOMER' || injectedRole === 'AGENT' ? injectedRole : null;
}

export function getTestInjectedUser(): string | null {
  if (typeof window === 'undefined' || !isLocalAuthOverrideEnabled()) {
    return null;
  }
  const injectedUser = window.localStorage.getItem(TEST_USER_KEY);
  return injectedUser && injectedUser.trim() ? injectedUser.trim() : null;
}

export function subscribeToAuthChanges(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener(AUTH_CHANGED_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
