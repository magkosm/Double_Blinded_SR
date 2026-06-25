import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AuthSession } from '../types';

interface AuthContextValue {
  session: AuthSession | null;
  reviewerPassword: string | null;
  projectPassword: string | null;
  setSession: (session: AuthSession | null) => void;
  setReviewerPassword: (password: string | null) => void;
  setProjectPassword: (password: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(() => {
    const raw = sessionStorage.getItem('sr_session');
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  });
  const [reviewerPassword, setReviewerPasswordState] = useState<string | null>(null);
  const [projectPassword, setProjectPasswordState] = useState<string | null>(null);

  const setSession = useCallback((s: AuthSession | null) => {
    setSessionState(s);
    if (s) sessionStorage.setItem('sr_session', JSON.stringify(s));
    else sessionStorage.removeItem('sr_session');
  }, []);

  const setReviewerPassword = useCallback((p: string | null) => {
    setReviewerPasswordState(p);
  }, []);

  const setProjectPassword = useCallback((p: string | null) => {
    setProjectPasswordState(p);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setReviewerPassword(null);
    setProjectPassword(null);
  }, [setSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        reviewerPassword,
        projectPassword,
        setSession,
        setReviewerPassword,
        setProjectPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
