import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface AuthState {
  passwordHash: string | null;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

interface Session {
  token: string;
  expiresAt: number;
}

export class AuthStore {
  private state: AuthState = { passwordHash: null };
  private sessions = new Map<string, Session>();
  private readonly configPath: string;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  load(initial: AuthState) {
    this.state = { passwordHash: initial.passwordHash ?? null };
  }

  hasPassword(): boolean {
    return !!this.state.passwordHash;
  }

  verifyHash(hash: string): boolean {
    if (!this.state.passwordHash) return false;
    const a = Buffer.from(this.state.passwordHash, 'utf8');
    const b = Buffer.from(hash, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  async setPassword(hash: string): Promise<void> {
    if (typeof hash !== 'string' || !hash.trim()) {
      throw new Error('Password hash is required');
    }
    this.state.passwordHash = hash.trim();
    await this.persist();
  }

  async clearPassword(): Promise<void> {
    this.state.passwordHash = null;
    this.sessions.clear();
    await this.persist();
  }

  createSession(): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, { token, expiresAt: Date.now() + SESSION_TTL_MS });
    this.pruneExpired();
    return token;
  }

  destroySession(token: string | undefined): void {
    if (!token) return;
    this.sessions.delete(token);
  }

  isSessionValid(token: string | undefined): boolean {
    if (!token) return false;
    const s = this.sessions.get(token);
    if (!s) return false;
    if (s.expiresAt < Date.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  private pruneExpired() {
    const now = Date.now();
    for (const [k, v] of this.sessions) {
      if (v.expiresAt < now) this.sessions.delete(k);
    }
  }

  private async persist(): Promise<void> {
    let raw: any = {};
    if (fs.existsSync(this.configPath)) {
      try {
        raw = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      } catch {
        raw = {};
      }
    }
    raw.auth = raw.auth && typeof raw.auth === 'object' ? raw.auth : {};
    if (this.state.passwordHash) {
      raw.auth.passwordHash = this.state.passwordHash;
    } else {
      delete raw.auth.passwordHash;
      if (Object.keys(raw.auth).length === 0) delete raw.auth;
    }
    const dir = path.dirname(this.configPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }
}

function extractToken(req: Request): string | undefined {
  const h = req.headers['authorization'];
  if (typeof h === 'string' && h.toLowerCase().startsWith('bearer ')) {
    return h.slice(7).trim();
  }
  const x = req.headers['x-keynest-token'];
  if (typeof x === 'string' && x.trim()) return x.trim();
  return undefined;
}

export function createAuthMiddleware(store: AuthStore) {
  return function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (!store.hasPassword()) return next();
    const token = extractToken(req);
    if (!store.isSessionValid(token)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };
}

export { extractToken };
