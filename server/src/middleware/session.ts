import { Request, Response, NextFunction } from 'express';
import { getStore } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      sessionToken?: string;
      playerName?: string;
    }
  }
}

export function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing session token' });
  }

  const token = authHeader.slice(7);
  const store = getStore();
  const session = store.sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid session token' });
  }

  session.lastSeen = new Date().toISOString();
  req.sessionToken = session.token;
  req.playerName = session.playerName;
  next();
}
