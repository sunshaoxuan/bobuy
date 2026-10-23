import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatWebSocket } from './useChatWebSocket';

const apiMocks = vi.hoisted(() => ({
  refreshAuthSession: vi.fn()
}));

const websocketMocks = vi.hoisted(() => {
  const clients: any[] = [];

  class MockClient {
    public active = false;
    public config: Record<string, any>;
    public subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
    public deactivate = vi.fn(async () => {
      this.active = false;
    });
    public activate = vi.fn(() => {
      this.active = true;
    });
    public configure = vi.fn((nextConfig: Record<string, any>) => {
      this.config = { ...this.config, ...nextConfig };
    });

    constructor(config: Record<string, any>) {
      this.config = config;
      clients.push(this);
    }
  }

  return { MockClient, clients };
});

vi.mock('@stomp/stompjs', () => ({
  Client: websocketMocks.MockClient
}));

vi.mock('../api', () => ({
  refreshAuthSession: apiMocks.refreshAuthSession
}));

describe('useChatWebSocket', () => {
  beforeEach(() => {
    websocketMocks.clients.length = 0;
    window.localStorage.clear();
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    apiMocks.refreshAuthSession.mockReset();
    apiMocks.refreshAuthSession.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('connects with bearer token in STOMP headers', () => {
    window.localStorage.setItem('bobbuy_access_token', 'token-123');

    renderHook(() =>
      useChatWebSocket({
        enabled: true,
        destination: '/topic/trip/2000'
      })
    );

    expect(websocketMocks.clients).toHaveLength(1);
    expect(websocketMocks.clients[0].config.connectHeaders).toEqual({
      Authorization: 'Bearer token-123'
    });
    expect(websocketMocks.clients[0].activate).toHaveBeenCalled();
  });

  it('degrades to REST-only path when no token exists', () => {
    renderHook(() =>
      useChatWebSocket({
        enabled: true,
        destination: '/topic/trip/2000'
      })
    );

    expect(websocketMocks.clients).toHaveLength(0);
  });

  it('stops reconnecting after auth rejection when refresh fails', async () => {
    window.localStorage.setItem('bobbuy_access_token', 'token-123');

    renderHook(() =>
      useChatWebSocket({
        enabled: true,
        destination: '/topic/trip/2000'
      })
    );

    websocketMocks.clients[0].config.onStompError?.({});
    websocketMocks.clients[0].config.onWebSocketClose?.({});

    await waitFor(() => {
      expect(apiMocks.refreshAuthSession).toHaveBeenCalled();
      expect(websocketMocks.clients[0].deactivate).toHaveBeenCalled();
    });
  });

  it('refreshes the auth session after websocket auth rejection', async () => {
    window.localStorage.setItem('bobbuy_access_token', 'token-123');
    apiMocks.refreshAuthSession.mockResolvedValue({
      accessToken: 'token-456',
      accessTokenExpiresAt: '2026-05-01T00:00:00Z',
      refreshToken: 'refresh-456',
      refreshTokenExpiresAt: '2026-05-08T00:00:00Z',
      user: { id: 1000, username: 'agent', name: 'Aiko Tan', roles: ['AGENT'] }
    });

    renderHook(() =>
      useChatWebSocket({
        enabled: true,
        destination: '/topic/trip/2000'
      })
    );

    websocketMocks.clients[0].config.onStompError?.({});

    await waitFor(() => {
      expect(apiMocks.refreshAuthSession).toHaveBeenCalledTimes(1);
      expect(websocketMocks.clients[0].deactivate).toHaveBeenCalled();
    });
  });
});
