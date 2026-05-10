import fs from 'fs';
import path from 'path';
import type { DBConfig } from './db';

export interface AuthConfig {
  passwordHash: string | null;
}

export interface AppConfig {
  port: number;
  host: string;
  database?: DBConfig;
  auth: AuthConfig;
  configPath: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_DB_PORT = 3306;
const DEFAULT_CONFIG_FILE = 'keynest.config.json';

function resolveConfigPath(): string {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) return argv[i + 1];
    if (argv[i].startsWith('--config=')) return argv[i].slice('--config='.length);
  }
  if (process.env.KEYNEST_CONFIG) return process.env.KEYNEST_CONFIG;
  return path.resolve(process.cwd(), DEFAULT_CONFIG_FILE);
}

function parseDatabase(raw: any): DBConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const host = typeof raw.host === 'string' ? raw.host.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const user = typeof raw.user === 'string' ? raw.user.trim() : '';
  if (!host || !name || !user) return undefined;
  const port = Number.isFinite(raw.port) && raw.port > 0 ? Math.floor(raw.port) : DEFAULT_DB_PORT;
  const password = typeof raw.password === 'string' ? raw.password : '';
  return { host, port, database: name, user, password };
}

function parseAuth(raw: any): AuthConfig {
  if (!raw || typeof raw !== 'object') return { passwordHash: null };
  const hash = typeof raw.passwordHash === 'string' && raw.passwordHash.trim()
    ? raw.passwordHash.trim()
    : null;
  return { passwordHash: hash };
}

export function loadConfig(): AppConfig {
  const configPath = resolveConfigPath();

  if (!fs.existsSync(configPath)) {
    return {
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
      auth: { passwordHash: null },
      configPath,
    };
  }

  let raw: any;
  try {
    const text = fs.readFileSync(configPath, 'utf8');
    raw = JSON.parse(text);
  } catch (e: any) {
    throw new Error(`Failed to parse config file ${configPath}: ${e.message}`);
  }

  const port = Number.isFinite(raw?.port) && raw.port > 0 ? Math.floor(raw.port) : DEFAULT_PORT;
  const host = typeof raw?.host === 'string' && raw.host.trim() ? raw.host.trim() : DEFAULT_HOST;
  const database = parseDatabase(raw?.database);
  const auth = parseAuth(raw?.auth);

  return { port, host, database, auth, configPath };
}
