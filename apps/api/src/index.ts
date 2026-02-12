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

initFirebaseAdmin();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());

// CORS: support configured origins or permissive in dev
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : true; // allow all in dev
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json({ limit: '1mb' }));

// Request logger (production diagnostics)
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
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
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — catches all thrown/next(err) errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err?.message || err);
  if (err?.stack) console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

app.listen(PORT, async () => {
  console.log(`[MdavelCTF API] listening on http://localhost:${PORT}`);
  // Bootstrap admin on startup (idempotent)
  await bootstrapAdmin();
});
