import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { loadAccounts, saveAccounts, getMysqlConfig, setMysqlConfig, clearMysqlConfig } from '@/lib/storage';
import type { MysqlConfig } from '@/lib/storage';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchAccountsFromMysql,
  pushAccountToMysql,
  deleteAccountFromMysql,
  isMysqlDirectSupported,
} from '@/lib/mysql-client';
import type { OTPAccount } from '@/lib/otp';

export type SortBy = 'name' | 'issuer' | 'createdAt';
type SyncStrategy = 'none' | 'web-http' | 'android-jdbc';

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
  pushOneToRemote: (id: string) => Promise<{ ok: boolean; error?: string }>;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncAt: string | null;
  mysqlConfig: MysqlConfig | null;
  saveMysqlConfig: (cfg: MysqlConfig) => Promise<void>;
  removeMysqlConfig: () => Promise<void>;
  syncStrategy: SyncStrategy;
  canSyncRemote: boolean;
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

async function probeWebSync(): Promise<boolean> {
  try {
    const res = await apiRequest('GET', '/api/settings/status') as { dbConfigured?: boolean };
    return !!res?.dbConfigured;
  } catch {
    return false;
  }
}

function migrateLocal(list: OTPAccount[]): OTPAccount[] {
  return list.map(a => ({ ...a, pinned: a.pinned ?? false }));
}

export function mergeById(local: OTPAccount[], remote: OTPAccount[]): {
  merged: OTPAccount[];
  toPush: OTPAccount[];
} {
  const byId = new Map<string, OTPAccount>();
  for (const a of remote) byId.set(a.id, { ...a, syncedAt: a.updatedAt });
  const toPush: OTPAccount[] = [];
  for (const l of local) {
    const r = byId.get(l.id);
    if (!r) {
      byId.set(l.id, l);
      toPush.push(l);
      continue;
    }
    if ((l.updatedAt ?? '') > (r.updatedAt ?? '')) {
      byId.set(l.id, l);
      toPush.push(l);
    }
  }
  return { merged: [...byId.values()], toPush };
}

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const { isAnonymous } = useAuth();
  const [accounts, setAccounts] = useState<OTPAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [mysqlConfig, setMysqlConfigState] = useState<MysqlConfig | null>(null);

  const webSyncAvailableRef = useRef(false);
  const accountsRef = useRef<OTPAccount[]>([]);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);

  const canJdbc = Platform.OS === 'android' && isMysqlDirectSupported();

  const syncStrategy: SyncStrategy =
    canJdbc && mysqlConfig ? 'android-jdbc' :
    Platform.OS === 'web' && !isAnonymous && webSyncAvailableRef.current ? 'web-http' :
    'none';

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const local = migrateLocal(await loadAccounts());
        setAccounts(local);

        if (Platform.OS === 'web') {
          if (!isAnonymous) {
            webSyncAvailableRef.current = await probeWebSync();
            if (webSyncAvailableRef.current) {
              try {
                const remote = await apiRequest('GET', '/api/accounts') as OTPAccount[];
                if (Array.isArray(remote)) {
                  const { merged } = mergeById(local, remote);
                  const normalized = migrateLocal(merged);
                  setAccounts(normalized);
                  await saveAccounts(normalized);
                }
              } catch (e) { console.error('[sync] initial pull failed', e); }
            }
          }
          return;
        }

        if (canJdbc) {
          const cfg = await getMysqlConfig();
          setMysqlConfigState(cfg);
          if (cfg && cfg.autoSync !== false) {
            await runJdbcSync(cfg, local);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runJdbcSync = async (cfg: MysqlConfig, localBase: OTPAccount[]): Promise<void> => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const remote = await fetchAccountsFromMysql(cfg);
      const { merged, toPush } = mergeById(localBase, remote);
      let normalized = migrateLocal(merged);
      for (const a of toPush) {
        try {
          await pushAccountToMysql(cfg, a);
          normalized = normalized.map(x => x.id === a.id ? { ...x, syncedAt: a.updatedAt } : x);
        } catch { /* best-effort */ }
      }
      setAccounts(normalized);
      await saveAccounts(normalized);
      setLastSyncAt(new Date().toISOString());
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const persistLocal = async (updated: OTPAccount[]) => {
    setAccounts(updated);
    await saveAccounts(updated);
  };

  const markSynced = (id: string, syncedAt: string) => {
    const list = accountsRef.current.map(a => a.id === id ? { ...a, syncedAt } : a);
    setAccounts(list);
    void saveAccounts(list);
  };

  const pushMutation = async (kind: 'upsert' | 'delete', payload: OTPAccount | string) => {
    if (syncStrategy === 'android-jdbc' && mysqlConfig) {
      try {
        if (kind === 'upsert') {
          const acc = payload as OTPAccount;
          await pushAccountToMysql(mysqlConfig, acc);
          markSynced(acc.id, acc.updatedAt);
        } else {
          await deleteAccountFromMysql(mysqlConfig, payload as string);
        }
      } catch (e) { console.error('[sync] jdbc mutation failed', e); }
      return;
    }
    if (syncStrategy === 'web-http') {
      try {
        if (kind === 'upsert') {
          const acc = payload as OTPAccount;
          await apiRequest('POST', '/api/accounts', acc);
          markSynced(acc.id, acc.updatedAt);
        } else {
          await apiRequest('DELETE', `/api/accounts/${payload as string}`);
        }
      } catch (e) { console.error('[sync] http mutation failed', e); }
    }
  };

  const pushOneToRemote = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const acc = accountsRef.current.find(a => a.id === id);
    if (!acc) return { ok: false, error: 'Account not found' };

    if (canJdbc) {
      const cfg = mysqlConfig ?? await getMysqlConfig();
      if (!cfg) {
        const msg = 'No MySQL config saved';
        setSyncError(msg);
        return { ok: false, error: msg };
      }
      if (!mysqlConfig) setMysqlConfigState(cfg);
      try {
        await pushAccountToMysql(cfg, acc);
        markSynced(acc.id, acc.updatedAt);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Push failed';
        setSyncError(msg);
        return { ok: false, error: msg };
      }
    }

    if (Platform.OS === 'web') {
      if (!webSyncAvailableRef.current) {
        webSyncAvailableRef.current = await probeWebSync();
      }
      if (!webSyncAvailableRef.current) {
        const msg = 'Remote sync not configured on the server';
        setSyncError(msg);
        return { ok: false, error: msg };
      }
      try {
        await apiRequest('POST', '/api/accounts', acc);
        markSynced(acc.id, acc.updatedAt);
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Push failed';
        setSyncError(msg);
        return { ok: false, error: msg };
      }
    }

    const msg = 'No remote backend available';
    setSyncError(msg);
    return { ok: false, error: msg };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canJdbc, mysqlConfig]);

  const addAccount = useCallback(async (account: OTPAccount) => {
    const withPin = { ...account, pinned: account.pinned ?? false };
    const updated = [...accountsRef.current, withPin];
    await persistLocal(updated);
    await pushMutation('upsert', withPin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStrategy, mysqlConfig]);

  const updateAccount = useCallback(async (id: string, updates: Partial<OTPAccount>) => {
    const updated = accountsRef.current.map(a => a.id === id
      ? { ...a, ...updates, updatedAt: new Date().toISOString() }
      : a
    );
    await persistLocal(updated);
    const found = updated.find(a => a.id === id);
    if (found) await pushMutation('upsert', found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStrategy, mysqlConfig]);

  const deleteAccount = useCallback(async (id: string) => {
    const updated = accountsRef.current.filter(a => a.id !== id);
    await persistLocal(updated);
    await pushMutation('delete', id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStrategy, mysqlConfig]);

  const togglePin = useCallback(async (id: string) => {
    const updated = accountsRef.current.map(a =>
      a.id === id ? { ...a, pinned: !a.pinned, updatedAt: new Date().toISOString() } : a
    );
    await persistLocal(updated);
    const found = updated.find(a => a.id === id);
    if (found) await pushMutation('upsert', found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStrategy, mysqlConfig]);

  const syncWithRemote = useCallback(async () => {
    if (canJdbc) {
      const cfg = mysqlConfig ?? await getMysqlConfig();
      if (!cfg) {
        setSyncError('No MySQL config saved');
        return;
      }
      if (!mysqlConfig) setMysqlConfigState(cfg);
      await runJdbcSync(cfg, accountsRef.current);
      return;
    }

    // Web fallback: original behavior
    setIsSyncing(true);
    setSyncError(null);
    try {
      if (!webSyncAvailableRef.current) {
        webSyncAvailableRef.current = await probeWebSync();
      }
      if (!webSyncAvailableRef.current) {
        setSyncError('Remote sync not configured on the server');
        return;
      }
      const remote = await apiRequest('GET', '/api/accounts') as OTPAccount[];
      if (Array.isArray(remote)) {
        const { merged } = mergeById(accountsRef.current, remote);
        const normalized = migrateLocal(merged);
        setAccounts(normalized);
        await saveAccounts(normalized);
        setLastSyncAt(new Date().toISOString());
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [canJdbc, mysqlConfig]);

  const saveMysqlConfig = useCallback(async (cfg: MysqlConfig) => {
    await setMysqlConfig(cfg);
    setMysqlConfigState(cfg);
    if (canJdbc && cfg.autoSync !== false) {
      await runJdbcSync(cfg, accountsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canJdbc]);

  const removeMysqlConfig = useCallback(async () => {
    await clearMysqlConfig();
    setMysqlConfigState(null);
    setLastSyncAt(null);
    setSyncError(null);
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

  const canSyncRemote =
    syncStrategy === 'android-jdbc' ? !!mysqlConfig :
    syncStrategy === 'web-http' ? webSyncAvailableRef.current :
    Platform.OS === 'web' && !isAnonymous;

  return (
    <AccountsContext.Provider value={{
      accounts, filteredAccounts, isLoading,
      searchQuery, sortBy,
      setSearchQuery, setSortBy,
      addAccount, updateAccount, deleteAccount,
      togglePin,
      syncWithRemote, pushOneToRemote, isSyncing, syncError, lastSyncAt,
      mysqlConfig, saveMysqlConfig, removeMysqlConfig,
      syncStrategy, canSyncRemote,
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
