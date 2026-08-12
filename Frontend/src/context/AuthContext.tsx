import {  useContext, useEffect, useState } from 'react';
import { authApi} from '../api/api';
import type { AuthUser } from '../api/api';
import { createContext } from 'react';
import type { ReactNode } from 'react';
import { AxiosError } from 'axios';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; 
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('amm_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user }) => {
        setUser(user);
        localStorage.setItem('amm_user', JSON.stringify(user));
      })
      .catch(() => {
        localStorage.removeItem('amm_token');
        localStorage.removeItem('amm_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    try {
      const { token, user } = await authApi.login(email, password);
      localStorage.setItem('amm_token', token);
      localStorage.setItem('amm_user', JSON.stringify(user));
      setUser(user);
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.message ?? 'Login failed' : 'Login failed';
      setError(message);
      throw err;
    }
  }

  async function signup(name: string, email: string, password: string) {
    setError(null);
    try {
      const { token, user } = await authApi.signup(name, email, password);
      localStorage.setItem('amm_token', token);
      localStorage.setItem('amm_user', JSON.stringify(user));
      setUser(user);
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.message ?? 'Signup failed' : 'Signup failed';
      setError(message);
      throw err;
    }
  }

  function logout() {
    authApi.logout();
    localStorage.removeItem('amm_token');
    localStorage.removeItem('amm_user');
    setUser(null);
  }

  function clearError() {
    setError(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, signup, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
