import express from 'express';
import cors from 'cors';
import accountsRouter from './routes/accounts';
import settingsRouter from './routes/settings';
import { createAuthRouter } from './routes/auth';
import { loadConfig } from './config';
import { initFromConfig } from './db';
import { AuthStore, createAuthMiddleware } from './auth';
import { WEB_BUNDLE } from './web-bundle.generated';

function sendBundled(res: express.Response, entry: { type: string; data: string }) {
  const buf = Buffer.from(entry.data, 'base64');
  res.setHeader('Content-Type', entry.type);
  res.setHeader('Content-Length', buf.length.toString());
  res.end(buf);
}

async function main() {
  const cfg = loadConfig();
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['X-Keynest-Auth-Required'],
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const originalUrl = req.originalUrl;
    res.on('finish', () => {
      const ms = Date.now() - start;
      const line = `[${new Date().toISOString()}] ${method} ${originalUrl} → ${res.statusCode} (${ms}ms)`;
      if (res.statusCode >= 500) console.error(line);
      else if (res.statusCode >= 400) console.warn(line);
      else console.log(line);
    });
    next();
  });

  const authStore = new AuthStore(cfg.configPath);
  authStore.load({ passwordHash: cfg.auth.passwordHash });
  const requireAuth = createAuthMiddleware(authStore);

  app.use('/api/auth', createAuthRouter(authStore));
  app.use('/api/accounts', requireAuth, accountsRouter);
  app.use('/api/settings', requireAuth, settingsRouter);

  app.get('/health', (_, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  const webKeys = Object.keys(WEB_BUNDLE);
  const indexEntry = WEB_BUNDLE['/index.html'];

  if (indexEntry) {
    app.get(/^\/(?!api\/|health$).*/, (req, res) => {
      const pathname = decodeURIComponent(req.path);

      const direct = WEB_BUNDLE[pathname];
      if (direct) return sendBundled(res, direct);

      const asHtml = WEB_BUNDLE[pathname + '.html'];
      if (asHtml) return sendBundled(res, asHtml);

      const asIndex = WEB_BUNDLE[pathname.replace(/\/$/, '') + '/index.html'];
      if (asIndex) return sendBundled(res, asIndex);

      sendBundled(res, indexEntry);
    });

    console.log(`Serving web app from bundled assets (${webKeys.length} files)`);
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
              <li>GET /api/auth/status — check if password is set</li>
              <li>POST /api/auth/login — authenticate and receive token</li>
              <li>GET /api/accounts — list all accounts (auth required)</li>
              <li>POST /api/accounts — create account (auth required)</li>
              <li>PUT /api/accounts/:id — update account (auth required)</li>
              <li>DELETE /api/accounts/:id — delete account (auth required)</li>
              <li>GET /api/settings/status — sync availability (auth required)</li>
              <li>GET /health — health check</li>
            </ul>
            <p class="hint">Run <code>npm run build:web</code> then <code>npm run bundle:web</code> to embed the web app.</p>
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

  if (authStore.hasPassword()) {
    console.log('Web auth: password configured (clients must log in)');
  } else {
    console.log('Web auth: no password configured (first visitor will set it up)');
  }

  app.listen(cfg.port, cfg.host, () => {
    console.log(`Key Nest API server listening on ${cfg.host}:${cfg.port}`);
  });
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
