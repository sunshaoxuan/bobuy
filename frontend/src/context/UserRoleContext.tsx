import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  clearAuthSession,
  getStoredAccessToken,
  getStoredAccessTokenExpiresAt,
  getStoredRefreshTokenExpiresAt,
  getStoredUser,
  getTestInjectedRole,
  getTestInjectedUser,
  storeAuthSession,
  subscribeToAuthChanges,
  type AuthenticatedUser,
  type UserRole
} from '../authStorage';

interface UserRoleContextValue {
  roles: UserRole[];
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
  isPurchaser: boolean;
  isCustomer: boolean;
  isMerchant: boolean;
}

const SEED_AGENT_ID = 1000;
const SEED_CUSTOMER_ID = 1001;

const UserRoleContext = createContext<UserRoleContextValue | undefined>(undefined);

function getInjectedUser(role: UserRole): AuthenticatedUser {
  const injectedUser = getTestInjectedUser();
  const fallbackId = role === 'AGENT' ? SEED_AGENT_ID : SEED_CUSTOMER_ID;
  return {
    id: Number(injectedUser) || fallbackId,
    username: injectedUser ?? `test-${role.toLowerCase()}`,
    name: injectedUser ?? `Test ${role.toLowerCase()}`,
    roles: [role]
  };
}

function readSessionUser(): AuthenticatedUser | null {
  const storedUser = getStoredUser();
  if (storedUser && getStoredAccessToken()) {
    return storedUser;
  }
  const injectedRole = getTestInjectedRole();
  return injectedRole ? getInjectedUser(injectedRole) : null;
}

function persistCurrentUser(user: AuthenticatedUser) {
  const accessToken = getStoredAccessToken();
  if (!accessToken) {
    return;
  }
  storeAuthSession({
    accessToken,
    accessTokenExpiresAt: getStoredAccessTokenExpiresAt(),
    refreshTokenExpiresAt: getStoredRefreshTokenExpiresAt(),
    user
  });
}

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => readSessionUser());
  const [loading, setLoading] = useState(() => Boolean(getStoredAccessToken()));

  const syncFromStorage = useCallback(() => {
    setUser(readSessionUser());
  }, []);

  useEffect(() => {
    syncFromStorage();
    return subscribeToAuthChanges(syncFromStorage);
  }, [syncFromStorage]);

  useEffect(() => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api.auth
      .me()
      .then((currentUser) => {
        if (!active) {
          return;
        }
        persistCurrentUser(currentUser);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        clearAuthSession();
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const loginResult = await api.auth.login({ username, password });
      storeAuthSession(loginResult);
      const currentUser = await api.auth.me();
      persistCurrentUser(currentUser);
      return currentUser;
    } catch (error) {
      clearAuthSession();
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout errors and always clear the local session.
    } finally {
      clearAuthSession();
    }
  }, []);

  const roles = user?.roles ?? [];
  const isAuthenticated = user !== null;
  const value = useMemo(
    () => ({
      roles,
      user,
      isAuthenticated,
      loading,
      login,
      logout,
      isPurchaser: roles.includes('AGENT'),
      isCustomer: roles.includes('CUSTOMER'),
      isMerchant: roles.includes('AGENT')
    }),
    [isAuthenticated, loading, login, logout, roles, user]
  );

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}

export type { UserRole };
