import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initFirebaseAdmin } from './firebase';
import { bootstrapAdmin } from './utils/bootstrapAdmin';
import { healthRouter } from './routes/health';
import { submitRouter } from './routes/submit';
import { teamRouter } from './routes/team';
import { adminRouter } from './routes/admin';
import { profileRouter } from './routes/profile';
import { gamificationRouter } from './routes/gamification';
import { classesRouter } from './routes/classes';
import { eventTeamsRouter } from './routes/eventTeams';

const BUILD_TAG = '2026-02-12T02';
initFirebaseAdmin();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());

// CORS: support configured origins or permissive in dev
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => {
      let origin = o.trim();
      // Auto-fix missing protocol — CORS requires full origin with https://
      if (origin && !origin.startsWith('http://') && !origin.startsWith('https://')) {
        origin = `https://${origin}`;
      }
      // Remove trailing slash
      return origin.replace(/\/+$/, '');
    })
  : true; // allow all in dev
console.log('[CORS] origins:', corsOrigins);
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json({ limit: '1mb' }));

// Request + Response logger (production diagnostics)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  console.log(`[REQ] ${req.method} ${req.path} origin=${req.headers.origin || 'none'}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log(`[REQ-BODY] ${JSON.stringify(req.body)?.slice(0, 500)}`);
  }

  // Intercept response to log status and body size
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);

  res.json = function (body: any) {
    console.log(`[RES] ${req.method} ${req.path} → ${res.statusCode} json(${JSON.stringify(body)?.slice(0, 200)}) ${Date.now() - start}ms`);
    return originalJson(body);
  };
  res.send = function (body: any) {
    console.log(`[RES] ${req.method} ${req.path} → ${res.statusCode} send(${typeof body}) ${Date.now() - start}ms`);
    return originalSend(body);
  };
  res.end = function (...args: any[]) {
    console.log(`[RES] ${req.method} ${req.path} → ${res.statusCode} end() ${Date.now() - start}ms`);
    return (originalEnd as any)(...args);
  };

  next();
});

// Diagnostic test endpoint — no auth, no Firestore
app.get('/api/test-ping', (_req: Request, res: Response) => {
  res.json({ pong: true, build: BUILD_TAG, time: new Date().toISOString() });
});
app.post('/api/test-echo', (req: Request, res: Response) => {
  res.json({ echo: req.body, build: BUILD_TAG, time: new Date().toISOString() });
});

app.use('/health', healthRouter);
app.use('/api', submitRouter);
app.use('/api/team', teamRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profile', profileRouter);
app.use('/api/gamification', gamificationRouter);
app.use('/api/classes', classesRouter);
app.use('/api/event-teams', eventTeamsRouter);

// 404 handler — no route matched
app.use((_req: Request, res: Response) => {
  console.log(`[404] ${_req.method} ${_req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — catches all thrown/next(err) errors
// Express requires EXACTLY 4 parameters to identify this as error middleware
app.use(function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[ERROR] ${_req.method} ${_req.path}:`, err?.message || err);
  if (err?.stack) console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

app.listen(PORT, async () => {
  console.log(`[MdavelCTF API] v${BUILD_TAG} listening on http://localhost:${PORT}`);
  // Bootstrap admin on startup (idempotent)
  await bootstrapAdmin();
});
