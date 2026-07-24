import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMe, logout as logoutRequest } from '../services/api';
import AuthContext from './authContext';

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    company_name: user.company?.name || user.company_name || 'Company',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);

  const saveAuthSession = useCallback((session) => {
    const nextUser = normalizeUser(session.user);

    setUser(nextUser);
    setIsInitializing(false);
  }, []);

  const refreshUser = useCallback(async () => {
    setIsRefreshingUser(true);

    try {
      const response = await getMe();
      const nextUser = normalizeUser(response.data);

      setUser(nextUser);
      return nextUser;
    } finally {
      setIsRefreshingUser(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (!user?.is_demo) {
        await logoutRequest();
      }
    } finally {
      setUser(null);
      setIsInitializing(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(refreshUser)
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsInitializing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      isInitializing,
      isRefreshingUser,
      logout,
      refreshUser,
      saveAuthSession,
      user,
    }),
    [isInitializing, isRefreshingUser, logout, refreshUser, saveAuthSession, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
