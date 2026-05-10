import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import accountsRouter from './routes/accounts';
import settingsRouter from './routes/settings';
import { loadConfig } from './config';
import { initFromConfig } from './db';

function resolveWebDist(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, '..', 'dist'),
    path.resolve(__dirname, 'dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

async function main() {
  const cfg = loadConfig();
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/accounts', accountsRouter);
  app.use('/api/settings', settingsRouter);

  app.get('/health', (_, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  const webDist = resolveWebDist();

  if (webDist) {
    app.use(express.static(webDist, { index: 'index.html', extensions: ['html'] }));

    app.get(/^\/(?!api\/|health$).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });

    console.log(`Serving web app from ${webDist}`);
  } else {
    app.get('/', (_, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Key Nest API</title>
          <style>
            body { font-family: -apple-system, sans-serif; background: #0A0B14; color: #F0F4FF; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #161A35; border: 1px solid #252A45; border-radius: 16px; padding: 40px; max-width: 440px; text-align: center; }
            h1 { color: #4B8BFF; margin: 0 0 12px; }
            p { color: #7B85A3; margin: 0 0 8px; }
            .badge { display: inline-block; background: #004D38; color: #00DFA0; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin-top: 16px; }
            ul { text-align: left; color: #7B85A3; }
            li { margin-bottom: 6px; font-size: 14px; }
            .hint { margin-top: 20px; font-size: 13px; color: #4B8BFF; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🔐 Key Nest API</h1>
            <p>Backend server for Key Nest authenticator app</p>
            <span class="badge">Running on port ${cfg.port}</span>
            <ul style="margin-top: 24px">
              <li>GET /api/accounts — list all accounts</li>
              <li>POST /api/accounts — create account</li>
              <li>PUT /api/accounts/:id — update account</li>
              <li>DELETE /api/accounts/:id — delete account</li>
              <li>GET /api/settings/status — sync availability</li>
              <li>GET /health — health check</li>
            </ul>
            <p class="hint">Run <code>npm run build:web</code> to bundle the web app into this server.</p>
          </div>
        </body>
        </html>
      `);
    });
  }

  const dbReady = await initFromConfig(cfg.database).catch(err => {
    console.error('MySQL initialization failed:', err.message);
    return false;
  });

  if (dbReady && cfg.database) {
    console.log(`MySQL connected to ${cfg.database.host}:${cfg.database.port}/${cfg.database.database}`);
  } else {
    console.warn('MySQL not configured — offline-only mode (accounts endpoints will return 503)');
  }

  app.listen(cfg.port, cfg.host, () => {
    console.log(`Key Nest API server listening on ${cfg.host}:${cfg.port}`);
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
