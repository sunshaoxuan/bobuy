import { api } from './api';
import { clearAuthSession, getStoredAccessToken, storeAuthSession } from './authStorage';

describe('api authentication headers and refresh recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'bobbuy_csrf_token=csrf-123; path=/';
    vi.restoreAllMocks();
    clearAuthSession();
    document.cookie = 'bobbuy_csrf_token=csrf-123; path=/';
  });

  it('adds Bearer token when an authenticated session exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [] })
    });
    vi.stubGlobal('fetch', fetchMock);
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

    await api.trips();

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('X-BOBBUY-ROLE')).toBeNull();
  });

  it('refreshes once on 401 and retries the original request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'expired' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'success',
          data: {
            accessToken: 'token-456',
            accessTokenExpiresAt: '2026-05-01T00:00:00Z',
            refreshToken: 'refresh-456',
            refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
            user: {
              id: 1000,
              username: 'agent',
              name: 'Aiko Tan',
              roles: ['AGENT']
            }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [] })
      });
    vi.stubGlobal('fetch', fetchMock);
    storeAuthSession({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      accessTokenExpiresAt: '2026-04-30T00:00:00Z',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: {
        id: 1000,
        username: 'agent',
        name: 'Aiko Tan',
        roles: ['AGENT']
      }
    });

    await api.trips();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/trips');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin'
    });
    const refreshHeaders = fetchMock.mock.calls[1][1]?.headers as Headers;
    expect(refreshHeaders.get('X-BOBBUY-CSRF-TOKEN')).toBe('csrf-123');
    expect(getStoredAccessToken()).toBe('token-456');
    expect(localStorage.getItem('bobbuy_refresh_token')).toBeNull();
  });

  it('coalesces concurrent 401 responses into one refresh request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'expired' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'expired' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'success',
          data: {
            accessToken: 'token-789',
            accessTokenExpiresAt: '2026-05-01T00:00:00Z',
            refreshToken: 'refresh-789',
            refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
            user: {
              id: 1000,
              username: 'agent',
              name: 'Aiko Tan',
              roles: ['AGENT']
            }
          }
        })
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [] })
      });
    vi.stubGlobal('fetch', fetchMock);
    storeAuthSession({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      accessTokenExpiresAt: '2026-04-30T00:00:00Z',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: {
        id: 1000,
        username: 'agent',
        name: 'Aiko Tan',
        roles: ['AGENT']
      }
    });

    await Promise.all([api.trips(), api.orders()]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears the session when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'expired' })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'refresh expired' })
      });
    vi.stubGlobal('fetch', fetchMock);
    storeAuthSession({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      accessTokenExpiresAt: '2026-04-30T00:00:00Z',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: {
        id: 1000,
        username: 'agent',
        name: 'Aiko Tan',
        roles: ['AGENT']
      }
    });

    await expect(api.trips()).rejects.toThrow('expired');
    expect(getStoredAccessToken()).toBeNull();
    expect(localStorage.getItem('bobbuy_refresh_token')).toBeNull();
  });

  it('sends logout with cookie credentials and csrf header without refresh token payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ status: 'success', data: { revoked: true } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.auth.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({})
      })
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get('X-BOBBUY-CSRF-TOKEN')).toBe('csrf-123');
  });
});
