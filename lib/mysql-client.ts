import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';
import type { MysqlConfig } from './storage';
import type { OTPAccount, OTPAlgorithm, OTPType } from './otp';

export class MysqlNotSupportedError extends Error {
  constructor(platform: string) {
    super(`Direct MySQL sync is not supported on ${platform}`);
    this.name = 'MysqlNotSupportedError';
  }
}

type NativeAccountRow = {
  id: string;
  uri: string;
  name: string;
  issuer: string;
  secret: string;
  algorithm: string;
  digits: number;
  period: number;
  type: string;
  counter: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

interface KeynestMysqlNativeModule {
  testConnection(cfg: MysqlConfig): Promise<{ ok: boolean; error?: string }>;
  getAllAccounts(cfg: MysqlConfig): Promise<NativeAccountRow[]>;
  upsertAccount(cfg: MysqlConfig, account: OTPAccount): Promise<void>;
  deleteAccount(cfg: MysqlConfig, id: string): Promise<void>;
}

let cached: KeynestMysqlNativeModule | null = null;

function getNativeModule(): KeynestMysqlNativeModule {
  if (Platform.OS !== 'android') {
    throw new MysqlNotSupportedError(Platform.OS);
  }
  if (!cached) {
    cached = requireNativeModule<KeynestMysqlNativeModule>('KeynestMysql');
  }
  return cached;
}

export function isMysqlDirectSupported(): boolean {
  return Platform.OS === 'android';
}

function normalizeRow(row: NativeAccountRow): OTPAccount {
  return {
    id: row.id,
    uri: row.uri ?? '',
    name: row.name ?? 'Unknown',
    issuer: row.issuer ?? '',
    secret: row.secret,
    algorithm: (row.algorithm as OTPAlgorithm) || 'SHA1',
    digits: (row.digits === 8 ? 8 : 6) as 6 | 8,
    period: row.period || 30,
    type: (row.type as OTPType) || 'totp',
    counter: row.counter || 0,
    pinned: !!row.pinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function testMysqlConnection(cfg: MysqlConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    return await getNativeModule().testConnection(cfg);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchAccountsFromMysql(cfg: MysqlConfig): Promise<OTPAccount[]> {
  const rows = await getNativeModule().getAllAccounts(cfg);
  return Array.isArray(rows) ? rows.map(normalizeRow) : [];
}

export async function pushAccountToMysql(cfg: MysqlConfig, account: OTPAccount): Promise<void> {
  await getNativeModule().upsertAccount(cfg, account);
}

export async function deleteAccountFromMysql(cfg: MysqlConfig, id: string): Promise<void> {
  await getNativeModule().deleteAccount(cfg, id);
}
