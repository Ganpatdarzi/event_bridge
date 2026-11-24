import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  loginRequest,
  logoutRequest,
  refreshSession,
  registerRequest,
  type PublicUser,
  type Session,
  type SessionProfile,
} from './api.js';

interface AuthContextValue {
  user: PublicUser | null;
  profile: SessionProfile | null;
  /** True while the initial session is being restored from the refresh cookie. */
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (body: unknown, email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((next: Session | null) => {
    setSession(next);
  }, []);

  const reload = useCallback(async () => {
    try {
      const next = await refreshSession();
      applySession(next);
    } catch {
      applySession(null);
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((next) => {
        if (active) applySession(next);
      })
      .catch(() => {
        if (active) applySession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    setSession({ user: result.user, profile: result.profile });
    return result.user;
  }, []);

  const register = useCallback(
    async (body: unknown, email: string, password: string) => {
      await registerRequest(body);
      try {
        return await login(email, password);
      } catch {
        throw new Error('Account created. Please sign in with your email and password.');
      }
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      profile: session?.profile ?? null,
      loading,
      login,
      register,
      logout,
      reload,
    }),
    [session, loading, login, register, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
