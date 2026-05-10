import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { OTPAccount } from './otp';

const ACCOUNTS_KEY = 'mfa_vault_accounts';
const PASSWORD_KEY = 'mfa_vault_password';

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { sessionStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  try { await SecureStore.setItemAsync(key, value); } catch { /* ignore */ }
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  try { await SecureStore.deleteItemAsync(key); } catch { /* ignore */ }
}

export async function loadAccounts(): Promise<OTPAccount[]> {
  try {
    const data = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!data) return [];
    return JSON.parse(data) as OTPAccount[];
  } catch {
    return [];
  }
}

export async function saveAccounts(accounts: OTPAccount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch { /* ignore */ }
}

export async function getPasswordHash(): Promise<string | null> {
  return secureGet(PASSWORD_KEY);
}

export async function setPasswordHash(hash: string): Promise<void> {
  await secureSet(PASSWORD_KEY, hash);
}

export async function clearPassword(): Promise<void> {
  await secureDelete(PASSWORD_KEY);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mfa_vault_salt_v1');
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  const str = password + 'mfa_vault_salt_v1';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = await getPasswordHash();
  if (!stored) return true;
  const hash = await hashPassword(password);
  return hash === stored;
}
