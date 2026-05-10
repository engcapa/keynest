import { Router, Request, Response } from 'express';
import type { AuthStore } from '../auth';
import { extractToken } from '../auth';

export function createAuthRouter(store: AuthStore): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      hasPassword: store.hasPassword(),
      enforced: store.hasPassword(),
    });
  });

  router.get('/session', (req: Request, res: Response) => {
    const token = extractToken(req);
    const valid = store.isSessionValid(token);
    res.json({ valid, hasPassword: store.hasPassword() });
  });

  router.post('/setup', async (req: Request, res: Response) => {
    if (store.hasPassword()) {
      return res.status(409).json({ error: 'Password already configured — use /change' });
    }
    const hash = typeof req.body?.passwordHash === 'string' ? req.body.passwordHash.trim() : '';
    if (!hash) return res.status(400).json({ error: 'passwordHash required' });
    try {
      await store.setPassword(hash);
      const token = store.createSession();
      res.json({ ok: true, token });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to save password' });
    }
  });

  router.post('/login', (req: Request, res: Response) => {
    if (!store.hasPassword()) {
      return res.status(409).json({ error: 'No password configured — call /setup first' });
    }
    const hash = typeof req.body?.passwordHash === 'string' ? req.body.passwordHash.trim() : '';
    if (!hash) return res.status(400).json({ error: 'passwordHash required' });
    if (!store.verifyHash(hash)) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const token = store.createSession();
    res.json({ ok: true, token });
  });

  router.post('/change', async (req: Request, res: Response) => {
    if (!store.hasPassword()) {
      return res.status(409).json({ error: 'No password configured — call /setup first' });
    }
    const token = extractToken(req);
    if (!store.isSessionValid(token)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const oldHash = typeof req.body?.oldHash === 'string' ? req.body.oldHash.trim() : '';
    const newHash = typeof req.body?.newHash === 'string' ? req.body.newHash.trim() : '';
    if (!oldHash || !newHash) return res.status(400).json({ error: 'oldHash and newHash required' });
    if (!store.verifyHash(oldHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    try {
      await store.setPassword(newHash);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to save password' });
    }
  });

  router.post('/logout', (req: Request, res: Response) => {
    const token = extractToken(req);
    store.destroySession(token);
    res.json({ ok: true });
  });

  return router;
}
