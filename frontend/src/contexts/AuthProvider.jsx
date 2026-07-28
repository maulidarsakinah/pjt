import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getMe,
  logout as logoutRequest,
  refreshSession,
  setAccessToken,
  setUnauthorizedHandler,
} from '../services/api';
import AuthContext from './authContext';

const DEMO_SESSION_KEY = 'hydrotrack_demo_session';

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
  const [authMessage, setAuthMessage] = useState('');

  const saveAuthSession = useCallback((session) => {
    const nextUser = normalizeUser(session.user);

    setAccessToken(session.token);
    setUser(nextUser);
    setAuthMessage('');
    setIsInitializing(false);

    if (nextUser?.is_demo) {
      window.sessionStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ user: nextUser })
      );
    } else {
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
    }
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
        window.sessionStorage.removeItem(DEMO_SESSION_KEY);
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
      window.sessionStorage.removeItem(DEMO_SESSION_KEY);
      setAuthMessage('Sesi berakhir. Silakan login kembali.');
      setIsInitializing(false);
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreAuthSession() {
      const storedDemoSession = window.sessionStorage.getItem(DEMO_SESSION_KEY);

      if (storedDemoSession) {
        try {
          const session = JSON.parse(storedDemoSession);

          if (session.user?.is_demo) {
            if (isActive) {
              setUser(normalizeUser(session.user));
              setIsInitializing(false);
            }
            return;
          }
        } catch {
          window.sessionStorage.removeItem(DEMO_SESSION_KEY);
        }
      }

      try {
        await refreshSession();
        const response = await getMe();

        if (isActive) {
          setUser(normalizeUser(response.data));
        }
      } catch {
        setAccessToken(null);
      } finally {
        if (isActive) {
          setIsInitializing(false);
        }
      }
    }

    restoreAuthSession();

    return () => {
      isActive = false;
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
