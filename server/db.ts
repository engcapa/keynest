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
    timezone: 'Z',
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
  await p.query(`
    CREATE TABLE IF NOT EXISTS mfa_accounts (
      id          CHAR(32)        CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      uri         TEXT            NOT NULL,
      name        VARCHAR(255)    NOT NULL,
      issuer      VARCHAR(255)    NOT NULL DEFAULT '',
      secret      VARCHAR(128)    NOT NULL,
      algorithm   ENUM('SHA1','SHA256','SHA512') NOT NULL DEFAULT 'SHA1',
      digits      TINYINT UNSIGNED NOT NULL DEFAULT 6,
      period      SMALLINT UNSIGNED NOT NULL DEFAULT 30,
      type        ENUM('totp','hotp') NOT NULL DEFAULT 'totp',
      counter     INT UNSIGNED    NOT NULL DEFAULT 0,
      pinned      TINYINT(1) UNSIGNED NOT NULL DEFAULT 0,
      created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_digits CHECK (digits IN (6, 8)),
      INDEX idx_pinned_name (pinned, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

export function getActivePool(): mysql.Pool | null {
  return pool;
}

export async function initFromConfig(db?: DBConfig): Promise<boolean> {
  if (!db || !db.host || !db.database || !db.user) return false;
  await getPool(db);
  await ensureTable(db);
  return true;
}
