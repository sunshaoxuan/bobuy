import { getStoredCsrfToken, storeAuthSession } from './authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'bobbuy_csrf_token=; Max-Age=0; Path=/';
  });

  it('does not persist refresh token in localStorage', () => {
    storeAuthSession({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      accessTokenExpiresAt: '2026-05-01T00:00:00Z',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: {
        id: 1000,
        username: 'agent',
        name: 'Aiko Tan',
        roles: ['AGENT']
      }
    });

    expect(localStorage.getItem('bobbuy_refresh_token')).toBeNull();
  });

  it('reads csrf token from cookie storage', () => {
    document.cookie = 'bobbuy_csrf_token=csrf-123; Path=/';

    expect(getStoredCsrfToken()).toBe('csrf-123');
  });
});
