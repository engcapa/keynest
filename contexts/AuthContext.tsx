import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPasswordHash, setPasswordHash, hashPassword, verifyPassword } from '@/lib/storage';

interface AuthContextType {
  isAuthenticated: boolean;
  hasPassword: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  setupPassword: (password: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const hash = await getPasswordHash();
      setHasPassword(!!hash);
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    const ok = await verifyPassword(password);
    if (ok) setIsAuthenticated(true);
    return ok;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const setupPassword = useCallback(async (password: string) => {
    const hash = await hashPassword(password);
    await setPasswordHash(hash);
    setHasPassword(true);
    setIsAuthenticated(true);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<boolean> => {
    const ok = await verifyPassword(oldPassword);
    if (!ok) return false;
    const hash = await hashPassword(newPassword);
    await setPasswordHash(hash);
    return true;
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, hasPassword, isLoading,
      login, logout, setupPassword, changePassword,
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
