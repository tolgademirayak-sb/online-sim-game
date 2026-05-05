import { Router } from 'express';
import { sessionAuth } from '../middleware/session.js';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG } from '../../../shared/dist/types.js';

const router = Router();

// All room routes require a session
router.use(sessionAuth);

// POST /api/rooms — create room
router.post('/', (req, res) => {
  try {
    const { password, gameConfig } = req.body;

    if (password !== undefined && typeof password !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }

    const config = {
      ...DEFAULT_CONFIG,
      ...(gameConfig || {}),
      demandConfig: { ...DEFAULT_DEMAND_CONFIG, ...(gameConfig?.demandConfig || {}) },
      timerConfig: { ...DEFAULT_CONFIG.timerConfig, ...(gameConfig?.timerConfig || {}) },
    };

    const roomId = roomService.createRoom(req.sessionToken!, password, config, {
      controllerMode: 'player',
      skipSeat: false,
    });
    res.json({ roomId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/join
router.post('/:id/join', (req, res) => {
  try {
    const { password } = req.body;
    if (password !== undefined && typeof password !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }

    roomService.joinRoom(req.params.id, req.sessionToken!, password);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/leave
router.post('/:id/leave', (req, res) => {
  try {
    roomService.leaveRoom(req.params.id, req.sessionToken!);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/rooms/:id — lobby poll
router.get('/:id', (req, res) => {
  try {
    const state = roomService.getRoomState(req.params.id, req.sessionToken!);
    res.json(state);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/rooms/:id/ready
router.post('/:id/ready', (req, res) => {
  try {
    roomService.setReady(req.params.id, req.sessionToken!);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/start
router.post('/:id/start', (req, res) => {
  try {
    const gameState = gameService.startGame(req.params.id, req.sessionToken!);
    res.json({ ok: true, gameState });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/config
router.post('/:id/config', (req, res) => {
  try {
    roomService.updateConfig(req.params.id, req.sessionToken!, req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/roles
router.post('/:id/roles', (req, res) => {
  try {
    const { assignments } = req.body;
    if (!assignments) return res.status(400).json({ error: 'assignments required' });
    roomService.assignRoles(req.params.id, req.sessionToken!, assignments);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:id/anonymous
router.post('/:id/anonymous', (req, res) => {
  try {
    const { enabled } = req.body;
    roomService.setAnonymousMode(req.params.id, req.sessionToken!, !!enabled);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
