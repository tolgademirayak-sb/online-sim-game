import { Router } from 'express';
import { sessionAuth } from '../middleware/session.js';
import * as gameService from '../services/gameService.js';

const router = Router();

router.use(sessionAuth);

// GET /api/rooms/:id/game — game poll
router.get('/:id/game', (req, res) => {
  try {
    const sinceVersion = req.query.since ? parseInt(req.query.since as string) : undefined;
    const poll = gameService.getGamePoll(req.params.id, req.sessionToken!, sinceVersion);

    if (poll === null && sinceVersion) {
      // No change since last version
      return res.status(304).end();
    }

    if (poll === null) {
      return res.status(404).json({ error: 'Game not found or not started' });
    }

    res.json(poll);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/orders — submit order
router.post('/:id/orders', (req, res) => {
  try {
    const { quantity } = req.body;
    if (typeof quantity !== 'number') {
      return res.status(400).json({ error: 'quantity must be a number' });
    }

    gameService.submitOrder(req.params.id, req.sessionToken!, quantity);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/draft — update draft order
router.post('/:id/draft', (req, res) => {
  try {
    const { quantity } = req.body;
    if (typeof quantity !== 'number') {
      return res.status(400).json({ error: 'quantity must be a number' });
    }

    gameService.updateDraft(req.params.id, req.sessionToken!, quantity);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/rooms/:id/results — full results (game over only)
router.get('/:id/results', (req, res) => {
  try {
    const results = gameService.getAuthorizedGameResults(req.params.id, req.sessionToken!);
    if (!results) {
      return res.status(404).json({ error: 'Game not finished or not found' });
    }
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
