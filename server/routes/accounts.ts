import { Router, Request, Response } from 'express';
import { getActivePool } from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const pool = getActivePool();
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    const [rows] = await pool.execute('SELECT * FROM mfa_accounts ORDER BY pinned DESC, name ASC');
    const accounts = (rows as any[]).map(r => ({
      id: r.id,
      uri: r.uri,
      name: r.name,
      issuer: r.issuer || '',
      secret: r.secret,
      algorithm: r.algorithm,
      digits: r.digits,
      period: r.period,
      type: r.type,
      counter: r.counter,
      pinned: r.pinned === 1 || r.pinned === true,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json(accounts);
  } catch (e: any) {
    console.error('[accounts.GET]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const pool = getActivePool();
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { id, uri, name, issuer, secret, algorithm, digits, period, type, counter, pinned, createdAt, updatedAt } = req.body;
  if (!id || !secret) return res.status(400).json({ error: 'Missing required fields' });
  try {
    await pool.execute(
      `INSERT INTO mfa_accounts (id, uri, name, issuer, secret, algorithm, digits, period, type, counter, pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), issuer=VALUES(issuer), pinned=VALUES(pinned), updated_at=VALUES(updated_at)`,
      [id, uri || '', name || 'Unknown', issuer || '', secret, algorithm || 'SHA1', digits || 6, period || 30, type || 'totp', counter || 0, pinned ? 1 : 0, createdAt, updatedAt]
    );
    res.status(201).json({ ok: true });
  } catch (e: any) {
    console.error('[accounts.POST]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const pool = getActivePool();
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  const { name, issuer, pinned, updatedAt } = req.body;
  try {
    await pool.execute(
      'UPDATE mfa_accounts SET name=?, issuer=?, pinned=?, updated_at=? WHERE id=?',
      [name, issuer || '', pinned ? 1 : 0, updatedAt || new Date().toISOString(), req.params.id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[accounts.PUT]', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const pool = getActivePool();
  if (!pool) return res.status(503).json({ error: 'Database not configured' });
  try {
    await pool.execute('DELETE FROM mfa_accounts WHERE id=?', [req.params.id]);
    res.status(204).send();
  } catch (e: any) {
    console.error('[accounts.DELETE]', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
