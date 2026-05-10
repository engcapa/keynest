import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { loadAccounts, saveAccounts } from '@/lib/storage';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import type { OTPAccount } from '@/lib/otp';

export type SortBy = 'name' | 'issuer' | 'createdAt';

interface AccountsContextType {
  accounts: OTPAccount[];
  filteredAccounts: OTPAccount[];
  isLoading: boolean;
  searchQuery: string;
  sortBy: SortBy;
  setSearchQuery: (q: string) => void;
  setSortBy: (s: SortBy) => void;
  addAccount: (account: OTPAccount) => Promise<void>;
  updateAccount: (id: string, updates: Partial<OTPAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  syncWithRemote: () => Promise<void>;
  isSyncing: boolean;
  syncError: string | null;
}

const AccountsContext = createContext<AccountsContextType | null>(null);

function sortAccounts(list: OTPAccount[], sortBy: SortBy): OTPAccount[] {
  return [...list].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'issuer') return a.issuer.localeCompare(b.issuer);
    if (sortBy === 'createdAt') return b.createdAt.localeCompare(a.createdAt);
    return 0;
  });
}

async function probeSyncAvailable(): Promise<boolean> {
  try {
    const res = await apiRequest('GET', '/api/settings/status') as { dbConfigured?: boolean };
    return !!res?.dbConfigured;
  } catch {
    return false;
  }
}

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<OTPAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncAvailableRef = useRef(false);

  useEffect(() => {
    (async () => {
      syncAvailableRef.current = await probeSyncAvailable();
      await loadLocal();
    })();
  }, []);

  const loadLocal = async () => {
    setIsLoading(true);
    try {
      const local = await loadAccounts();
      const migrated = local.map(a => ({ ...a, pinned: a.pinned ?? false }));
      setAccounts(migrated);
      if (Platform.OS === 'web') {
        await syncFromRemote();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const syncFromRemote = async () => {
    if (!syncAvailableRef.current) return;
    try {
      const remote = await apiRequest('GET', '/api/accounts') as OTPAccount[];
      if (Array.isArray(remote)) {
        const migrated = remote.map(a => ({ ...a, pinned: a.pinned ?? false }));
        setAccounts(migrated);
        if (Platform.OS !== 'web') {
          await saveAccounts(migrated);
        }
      }
    } catch {
      // offline - keep local
    }
  };

  const persist = async (updated: OTPAccount[]) => {
    setAccounts(updated);
    if (Platform.OS !== 'web') {
      await saveAccounts(updated);
    }
  };

  const pushToRemote = async (account: OTPAccount, method: 'POST' | 'PUT', path: string) => {
    if (!syncAvailableRef.current) return;
    try {
      await apiRequest(method, path, account);
    } catch {
      // offline - ignore
    }
  };

  const addAccount = useCallback(async (account: OTPAccount) => {
    const withPin = { ...account, pinned: account.pinned ?? false };
    const updated = [...accounts, withPin];
    await persist(updated);
    await pushToRemote(withPin, 'POST', '/api/accounts');
  }, [accounts]);

  const updateAccount = useCallback(async (id: string, updates: Partial<OTPAccount>) => {
    const updated = accounts.map(a => a.id === id
      ? { ...a, ...updates, updatedAt: new Date().toISOString() }
      : a
    );
    await persist(updated);
    const found = updated.find(a => a.id === id);
    if (found) await pushToRemote(found, 'PUT', `/api/accounts/${id}`);
  }, [accounts]);

  const deleteAccount = useCallback(async (id: string) => {
    const updated = accounts.filter(a => a.id !== id);
    await persist(updated);
    if (!syncAvailableRef.current) return;
    try {
      await apiRequest('DELETE', `/api/accounts/${id}`);
    } catch { /* offline */ }
  }, [accounts]);

  const togglePin = useCallback(async (id: string) => {
    const updated = accounts.map(a =>
      a.id === id ? { ...a, pinned: !a.pinned, updatedAt: new Date().toISOString() } : a
    );
    await persist(updated);
    const found = updated.find(a => a.id === id);
    if (found) await pushToRemote(found, 'PUT', `/api/accounts/${id}`);
  }, [accounts]);

  const syncWithRemote = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      if (!syncAvailableRef.current) {
        // retry probe in case the server came online after initial load
        syncAvailableRef.current = await probeSyncAvailable();
      }
      if (!syncAvailableRef.current) {
        setSyncError('Remote sync not configured on the server');
        return;
      }
      const remote = await apiRequest('GET', '/api/accounts') as OTPAccount[];
      if (Array.isArray(remote)) {
        const migrated = remote.map(a => ({ ...a, pinned: a.pinned ?? false }));
        setAccounts(migrated);
        await saveAccounts(migrated);
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const filteredAccounts = React.useMemo(() => {
    let result = [...accounts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.issuer.toLowerCase().includes(q)
      );
    }
    const pinned = sortAccounts(result.filter(a => a.pinned), sortBy);
    const unpinned = sortAccounts(result.filter(a => !a.pinned), sortBy);
    return [...pinned, ...unpinned];
  }, [accounts, searchQuery, sortBy]);

  return (
    <AccountsContext.Provider value={{
      accounts, filteredAccounts, isLoading,
      searchQuery, sortBy,
      setSearchQuery, setSortBy,
      addAccount, updateAccount, deleteAccount,
      togglePin,
      syncWithRemote, isSyncing, syncError,
    }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error('useAccounts must be used within AccountsProvider');
  return ctx;
}
