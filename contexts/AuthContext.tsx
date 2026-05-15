import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { getPasswordHash, setPasswordHash, hashPassword, verifyPassword, getIdleLockMinutes, subscribeIdleLockMinutes } from '@/lib/storage';
import { apiRequest, getAuthToken, setAuthToken } from '@/lib/query-client';

interface AuthContextType {
  isAuthenticated: boolean;
  hasPassword: boolean;
  isLoading: boolean;
  isAnonymous: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  setupPassword: (password: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  loginAnonymous: () => void;
  authBackend: 'local' | 'server';
}

const AuthContext = createContext<AuthContextType | null>(null);
const ANON_STORAGE_KEY = 'mfa_vault_anon';

function getWebFlag(key: string): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key) === '1';
  } catch { /* ignore */ }
  return false;
}

function setWebFlag(key: string, value: boolean): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage !== 'undefined') {
      if (value) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    }
  } catch { /* ignore */ }
}

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
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authBackend, setAuthBackend] = useState<'local' | 'server'>(
    Platform.OS === 'web' ? 'server' : 'local'
  );

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        if (getWebFlag(ANON_STORAGE_KEY)) {
          setIsAnonymous(true);
          setAuthBackend('local');
          setHasPassword(false);
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
        const status = await fetchServerStatus();
        if (status) {
          setAuthBackend('server');
          setHasPassword(status.hasPassword);
          if (status.hasPassword) {
            const valid = await fetchSessionValid();
            setIsAuthenticated(valid);
          } else {
            // No password configured yet — send user to setup screen (not authenticated).
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
          setWebFlag(ANON_STORAGE_KEY, false);
          setIsAnonymous(false);
          setIsAuthenticated(true);
          return true;
        }
      } catch {
        return false;
      }
      return false;
    }
    const ok = await verifyPassword(password);
    if (ok) {
      setWebFlag(ANON_STORAGE_KEY, false);
      setIsAnonymous(false);
      setIsAuthenticated(true);
    }
    return ok;
  }, [authBackend]);

  const logout = useCallback(() => {
    if (authBackend === 'server' && !isAnonymous) {
      apiRequest('POST', '/api/auth/logout').catch(() => {});
      setAuthToken(null);
    }
    setWebFlag(ANON_STORAGE_KEY, false);
    setIsAnonymous(false);
    setIsAuthenticated(false);
  }, [authBackend, isAnonymous]);

  const loginAnonymous = useCallback(() => {
    setWebFlag(ANON_STORAGE_KEY, true);
    setIsAnonymous(true);
    setAuthBackend('local');
    setHasPassword(false);
    setIsAuthenticated(true);
  }, []);

  const setupPassword = useCallback(async (password: string) => {
    const passwordHash = await hashPassword(password);
    if (authBackend === 'server') {
      const res = await apiRequest('POST', '/api/auth/setup', { passwordHash }) as { token: string };
      if (res?.token) setAuthToken(res.token);
      setWebFlag(ANON_STORAGE_KEY, false);
      setIsAnonymous(false);
      setHasPassword(true);
      setIsAuthenticated(true);
      return;
    }
    await setPasswordHash(passwordHash);
    setWebFlag(ANON_STORAGE_KEY, false);
    setIsAnonymous(false);
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

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const idleMinutesRef = useRef<number>(5);
  const logoutRef = useRef(logout);
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  useEffect(() => {
    const enabled = isAuthenticated && !isAnonymous;
    let cancelled = false;

    const clearTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const scheduleLock = () => {
      clearTimer();
      const minutes = idleMinutesRef.current;
      if (!enabled || !minutes || minutes <= 0) return;
      idleTimerRef.current = setTimeout(() => {
        logoutRef.current();
      }, minutes * 60 * 1000);
    };

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      scheduleLock();
    };

    (async () => {
      idleMinutesRef.current = await getIdleLockMinutes();
      if (cancelled) return;
      scheduleLock();
    })();

    const unsubMinutes = subscribeIdleLockMinutes((m) => {
      idleMinutesRef.current = m;
      scheduleLock();
    });

    let removeWeb: (() => void) | null = null;
    let appStateSub: { remove: () => void } | null = null;

    if (enabled) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        let lastReset = 0;
        const throttledReset = () => {
          const now = Date.now();
          if (now - lastReset < 30_000) return;
          lastReset = now;
          resetActivity();
        };
        const onVisibility = () => {
          if (document.visibilityState !== 'visible') return;
          const minutes = idleMinutesRef.current;
          if (minutes > 0 && Date.now() - lastActivityRef.current >= minutes * 60 * 1000) {
            logoutRef.current();
          } else {
            resetActivity();
          }
        };
        window.addEventListener('mousemove', throttledReset, { passive: true });
        window.addEventListener('keydown', throttledReset);
        window.addEventListener('touchstart', throttledReset, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);
        removeWeb = () => {
          window.removeEventListener('mousemove', throttledReset);
          window.removeEventListener('keydown', throttledReset);
          window.removeEventListener('touchstart', throttledReset);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      } else {
        appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            const minutes = idleMinutesRef.current;
            if (minutes > 0 && Date.now() - lastActivityRef.current >= minutes * 60 * 1000) {
              logoutRef.current();
            } else {
              resetActivity();
            }
          } else if (state === 'background' || state === 'inactive') {
            lastActivityRef.current = Date.now();
          }
        });
      }
    }

    return () => {
      cancelled = true;
      clearTimer();
      unsubMinutes();
      if (removeWeb) removeWeb();
      if (appStateSub) appStateSub.remove();
    };
  }, [isAuthenticated, isAnonymous]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated, hasPassword, isLoading, isAnonymous,
      login, logout, setupPassword, changePassword, loginAnonymous,
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
