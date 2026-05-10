import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { getPasswordHash, setPasswordHash, hashPassword, verifyPassword } from '@/lib/storage';
import { apiRequest, getAuthToken, setAuthToken } from '@/lib/query-client';

interface AuthContextType {
  isAuthenticated: boolean;
  hasPassword: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  setupPassword: (password: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  authBackend: 'local' | 'server';
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchServerStatus(): Promise<{ hasPassword: boolean } | null> {
  try {
    return await apiRequest('GET', '/api/auth/status') as { hasPassword: boolean };
  } catch {
    return null;
  }
}

async function fetchSessionValid(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await apiRequest('GET', '/api/auth/session') as { valid: boolean };
    return !!res?.valid;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authBackend, setAuthBackend] = useState<'local' | 'server'>(
    Platform.OS === 'web' ? 'server' : 'local'
  );

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        const status = await fetchServerStatus();
        if (status) {
          setAuthBackend('server');
          setHasPassword(status.hasPassword);
          if (status.hasPassword) {
            const valid = await fetchSessionValid();
            setIsAuthenticated(valid);
          } else {
            setIsAuthenticated(false);
          }
          setIsLoading(false);
          return;
        }
        // Server unreachable — fall back to local mode so the app remains usable.
        setAuthBackend('local');
      }
      const hash = await getPasswordHash();
      setHasPassword(!!hash);
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    if (authBackend === 'server') {
      const passwordHash = await hashPassword(password);
      try {
        const res = await apiRequest('POST', '/api/auth/login', { passwordHash }) as { token: string };
        if (res?.token) {
          setAuthToken(res.token);
          setIsAuthenticated(true);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    }
    const ok = await verifyPassword(password);
    if (ok) setIsAuthenticated(true);
    return ok;
  }, [authBackend]);

  const logout = useCallback(() => {
    if (authBackend === 'server') {
      apiRequest('POST', '/api/auth/logout').catch(() => {});
      setAuthToken(null);
    }
    setIsAuthenticated(false);
  }, [authBackend]);

  const setupPassword = useCallback(async (password: string) => {
    const passwordHash = await hashPassword(password);
    if (authBackend === 'server') {
      const res = await apiRequest('POST', '/api/auth/setup', { passwordHash }) as { token: string };
      if (res?.token) setAuthToken(res.token);
      setHasPassword(true);
      setIsAuthenticated(true);
      return;
    }
    await setPasswordHash(passwordHash);
    setHasPassword(true);
    setIsAuthenticated(true);
  }, [authBackend]);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const oldHash = await hashPassword(oldPassword);
    const newHash = await hashPassword(newPassword);
    if (authBackend === 'server') {
      try {
        await apiRequest('POST', '/api/auth/change', { oldHash, newHash });
        return true;
      } catch {
        return false;
      }
    }
    const ok = await verifyPassword(oldPassword);
    if (!ok) return false;
    await setPasswordHash(newHash);
    return true;
  }, [authBackend]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, hasPassword, isLoading,
      login, logout, setupPassword, changePassword,
      authBackend,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
