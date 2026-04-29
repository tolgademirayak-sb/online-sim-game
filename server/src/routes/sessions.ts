import { Router } from 'express';
import crypto from 'crypto';
import { getStore, persistStore } from '../db.js';
import { sessionAuth } from '../middleware/session.js';

const router = Router();

// POST /api/sessions — create anonymous session
router.post('/', (req, res) => {
  const { playerName } = req.body;

  if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
    return res.status(400).json({ error: 'playerName is required' });
  }

  const token = crypto.randomUUID();
  const store = getStore();
  const now = new Date().toISOString();

  store.sessions.set(token, {
    token,
    playerName: playerName.trim().slice(0, 20),
    createdAt: now,
    lastSeen: now,
  });

  persistStore();
  res.json({ token });
});

router.get('/me', sessionAuth, (req, res) => {
  res.json({
    token: req.sessionToken,
    playerName: req.playerName,
  });
});

export default router;
