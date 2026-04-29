import { Request, Response, NextFunction } from 'express';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-secret';

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.query.token as string) || req.headers['x-admin-token'] as string;

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Invalid admin token' });
  }

  next();
}
