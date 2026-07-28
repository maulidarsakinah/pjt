import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMe,
  logout as logoutRequest,
  setAccessToken,
  setUnauthorizedHandler,
} from '../services/api';
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
  const [isInitializing, setIsInitializing] = useState(false);
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const saveAuthSession = useCallback((session) => {
    const nextUser = normalizeUser(session.user);

    setAccessToken(session.token);
    setUser(nextUser);
    setAuthMessage('');
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

  const logout = useCallback(
    async ({ remote = true, message = '' } = {}) => {
      try {
        if (remote && user && !user.is_demo) {
          await logoutRequest();
        }
      } finally {
        setAccessToken(null);
        setUser(null);
        setAuthMessage(message);
        setIsInitializing(false);
      }
    },
    [user]
  );

  const clearAuthMessage = useCallback(() => {
    setAuthMessage('');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setAuthMessage('Sesi berakhir. Silakan login kembali.');
      setIsInitializing(false);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(user),
      isInitializing,
      isRefreshingUser,
      authMessage,
      clearAuthMessage,
      logout,
      refreshUser,
      saveAuthSession,
      user,
    }),
    [
      authMessage,
      clearAuthMessage,
      isInitializing,
      isRefreshingUser,
      logout,
      refreshUser,
      saveAuthSession,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
