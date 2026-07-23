import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearSession, getMe, getStoredUser, getToken, setSession } from '../services/api';
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
  const [token, setToken] = useState(() => getToken());
  const [user, setUser] = useState(() => normalizeUser(getStoredUser()));
  const [hasLoadedProfile, setHasLoadedProfile] = useState(() => {
    const storedUser = getStoredUser();
    return Boolean(storedUser?.roles || storedUser?.is_demo);
  });
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);

  const saveAuthSession = useCallback((session) => {
    const nextUser = normalizeUser(session.user);

    setSession({ token: session.token, user: nextUser });
    setToken(session.token);
    setUser(nextUser);
    setHasLoadedProfile(Boolean(nextUser?.roles || nextUser?.is_demo));
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      return null;
    }

    if (user?.is_demo) {
      return user;
    }

    setIsRefreshingUser(true);

    try {
      const response = await getMe();
      const nextUser = normalizeUser(response.data);
      const currentToken = getToken();

      if (currentToken) {
        setSession({ token: currentToken, user: nextUser });
      }

      setToken(currentToken);
      setUser(nextUser);
      setHasLoadedProfile(true);
      return nextUser;
    } finally {
      setIsRefreshingUser(false);
    }
  }, [user]);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    setHasLoadedProfile(false);
  }, []);

  useEffect(() => {
    if (!token || hasLoadedProfile || user?.is_demo) {
      return;
    }

    Promise.resolve().then(refreshUser).catch(() => {
      logout();
    });
  }, [hasLoadedProfile, logout, refreshUser, token, user]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      isRefreshingUser,
      logout,
      refreshUser,
      saveAuthSession,
      token,
      user,
    }),
    [isRefreshingUser, logout, refreshUser, saveAuthSession, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
