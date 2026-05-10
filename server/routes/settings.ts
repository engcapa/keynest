import { Router, Request, Response } from 'express';
import { getActivePool } from '../db';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({ dbConfigured: !!getActivePool() });
});

export default router;
