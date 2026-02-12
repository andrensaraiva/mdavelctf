import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async Express route handler so that rejected promises
 * are forwarded to Express error handling via next(err).
 *
 * Express 4 does NOT catch promise rejections from async handlers.
 * Without this wrapper, errors in async handlers are silently
 * swallowed and the client gets no response (or an empty 200).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
