import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export interface DBConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export async function getPool(config: DBConfig): Promise<mysql.Pool> {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

export async function testConnection(config: DBConfig): Promise<void> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });
  await conn.ping();
  await conn.end();
}

export async function ensureTable(cfg: DBConfig): Promise<void> {
  const p = await getPool(cfg);
  await p.execute(`
    CREATE TABLE IF NOT EXISTS mfa_accounts (
      id VARCHAR(64) PRIMARY KEY,
      uri TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      issuer VARCHAR(255) DEFAULT '',
      secret VARCHAR(512) NOT NULL,
      algorithm VARCHAR(10) DEFAULT 'SHA1',
      digits INT DEFAULT 6,
      period INT DEFAULT 30,
      type VARCHAR(10) DEFAULT 'totp',
      counter INT DEFAULT 0,
      created_at VARCHAR(64),
      updated_at VARCHAR(64)
    )
  `);
}

export function getActivePool(): mysql.Pool | null {
  return pool;
}
