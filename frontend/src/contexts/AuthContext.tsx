import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type LocalUser = {
  account_id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'superadmin' | 'committee';
};

interface AuthContextType {
  user: LocalUser | null;
  session: null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session] = useState<null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function init() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const resp = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        const json = await resp.json();
        if (json.ok && json.user) {
          setUser(json.user as LocalUser);
          setIsAdmin((json.user as LocalUser).role === 'admin' || (json.user as LocalUser).role === 'superadmin');
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch {
        localStorage.removeItem('auth_token');
      }
      setIsLoading(false);
    }
    void init();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const checkAdminRole = async (_userId: string) => {
    // No-op: Supabase removed. isAdmin is derived from local user role.
    return;
  };

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const body = email.includes('@') ? { email, password } : { username: email, password };
      const resp = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) {
        return { error: `Request failed (${resp.status})` };
      }
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        return { error: 'Backend returned non-JSON response' };
      }
      const json = await resp.json();
      if (!json.ok) return { error: json.error || 'Login failed' };
      localStorage.setItem('auth_token', json.token);
      setUser(json.user as LocalUser);
      setIsAdmin((json.user as LocalUser).role === 'admin' || (json.user as LocalUser).role === 'superadmin');
      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      return { error: msg };
    }
  };

  const refresh = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const resp = await fetch('/api/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return;
      const json = await resp.json();
      if (!json?.ok || !json?.token || !json?.user) return;
      localStorage.setItem('auth_token', String(json.token));
      setUser(json.user as LocalUser);
      setIsAdmin((json.user as LocalUser).role === 'admin' || (json.user as LocalUser).role === 'superadmin');
    } catch { return; }
  };

  const signUp = async (email: string, password: string, username: string): Promise<{ error: string | null }> => {
    try {
      const resp = await fetch('/api/gym-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, role: 'admin', is_active: true, password }) });
      const json = await resp.json();
      if (!json.ok) return { error: json.error || 'Sign up failed' };
      // Auto login after successful sign up
      return await login(email, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed';
      return { error: msg };
    }
  };

  const logout = async () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, login, signUp, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
