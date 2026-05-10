import { Router, Request, Response } from 'express';
import { testConnection, ensureTable, getPool, DBConfig } from '../db';

const router = Router();

let currentConfig: DBConfig | null = null;

router.post('/test', async (req: Request, res: Response) => {
  const { host, port, database, user, password } = req.body;
  if (!host || !database || !user) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  try {
    const cfg: DBConfig = { host, port: port || 3306, database, user, password: password || '' };
    await testConnection(cfg);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(200).json({ ok: false, error: e.message });
  }
});

router.post('/connect', async (req: Request, res: Response) => {
  const { host, port, database, user, password } = req.body;
  if (!host || !database || !user) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  try {
    const cfg: DBConfig = { host, port: port || 3306, database, user, password: password || '' };
    await ensureTable(cfg);
    currentConfig = cfg;
    res.json({ ok: true });
  } catch (e: any) {
    res.status(200).json({ ok: false, error: e.message });
  }
});

export default router;
