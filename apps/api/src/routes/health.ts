import { Router, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
