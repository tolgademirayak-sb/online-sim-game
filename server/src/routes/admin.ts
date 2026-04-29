import { Router } from 'express';
import { adminAuth } from '../middleware/admin.js';
import { getStore, persistStore } from '../db.js';
import * as gameService from '../services/gameService.js';
import type { AdminRoomSummary, AdminStatsResponse } from '../../../shared/dist/types.js';

const router = Router();

router.use(adminAuth);

// GET /api/admin/rooms — list all rooms
router.get('/rooms', (_req, res) => {
  const store = getStore();
  const result: AdminRoomSummary[] = [];

  for (const room of store.rooms.values()) {
    const gs = store.gameStates.get(room.id);
    const playerCount = store.roomPlayers.filter(p => p.roomId === room.id).length;

    result.push({
      id: room.id,
      status: room.status,
      playerCount,
      currentWeek: gs?.currentWeek || 0,
      totalWeeks: room.gameConfig.totalWeeks,
      createdAt: room.createdAt,
    });
  }

  // Sort newest first
  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(result);
});

// GET /api/admin/rooms/:id — full room + game state
router.get('/rooms/:id', (req, res) => {
  const store = getStore();
  const room = store.rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const players = store.roomPlayers
    .filter(p => p.roomId === req.params.id)
    .map(p => ({
      sessionToken: p.sessionToken,
      name: store.sessions.get(p.sessionToken)?.playerName || 'Unknown',
      role: p.role,
      isHost: p.isHost,
      isReady: p.isReady,
      isConnected: p.isConnected,
    }));

  const gameState = gameService.getFullGameState(req.params.id);

  res.json({
    room: {
      id: room.id,
      status: room.status,
      anonymousMode: room.anonymousMode,
      gameConfig: room.gameConfig,
      createdAt: room.createdAt,
    },
    players,
    gameState,
  });
});

// DELETE /api/admin/rooms/:id
router.delete('/rooms/:id', (req, res) => {
  const store = getStore();
  const roomId = req.params.id;

  if (!store.rooms.has(roomId)) {
    return res.status(404).json({ error: 'Room not found' });
  }

  store.rooms.delete(roomId);
  store.roomPlayers = store.roomPlayers.filter(p => p.roomId !== roomId);
  store.gameStates.delete(roomId);
  store.pendingOrders = store.pendingOrders.filter(o => o.roomId !== roomId);
  store.roundTimers.delete(roomId);

  persistStore();
  res.json({ ok: true });
});

// GET /api/admin/stats
router.get('/stats', (_req, res) => {
  const store = getStore();

  let activeGames = 0, completedGames = 0, lobbies = 0;
  for (const room of store.rooms.values()) {
    if (room.status === 'playing') activeGames++;
    else if (room.status === 'finished') completedGames++;
    else lobbies++;
  }

  const playerTokens = new Set(store.roomPlayers.map(p => p.sessionToken));

  const result: AdminStatsResponse = {
    totalRooms: store.rooms.size,
    activeGames,
    completedGames,
    lobbies,
    totalPlayers: playerTokens.size,
  };

  res.json(result);
});

export default router;
