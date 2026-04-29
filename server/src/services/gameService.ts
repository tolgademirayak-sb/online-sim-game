import { getStore, persistStore } from '../db.js';
import { initializeGame, advanceWeekMultiplayer, calculateBullwhipRatio } from '../../../shared/dist/gameLogic.js';
import type { Role, GameState, GameConfig, GamePollResponse, GameResultsResponse } from '../../../shared/dist/types.js';
import { markDisconnectedPlayers } from './roomService.js';

const ALL_ROLES: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

function now(): string {
  return new Date().toISOString();
}

function getRoundDurationSeconds(round: number, gameConfig: GameConfig): number {
  const tc = gameConfig.timerConfig;
  const finalRoundsStart = Math.max(1, gameConfig.totalWeeks - tc.finalRounds + 1);

  if (round <= tc.earlyRounds) return tc.earlyRoundDurationSec;
  if (round >= finalRoundsStart) return tc.finalRoundDurationSec;
  return tc.middleRoundDurationSec;
}

export function startGame(roomId: string, sessionToken: string): GameState {
  const store = getStore();

  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== sessionToken) throw new Error('Only host can start');
  if (room.status !== 'lobby') throw new Error('Game already started');

  markDisconnectedPlayers(roomId);
  const players = store.roomPlayers.filter(p => p.roomId === roomId && p.isConnected);
  const readyPlayers = players.filter(p => p.isReady && p.role);
  if (readyPlayers.length < 1) throw new Error('Need at least 1 ready player');

  const humanRoles = readyPlayers.map(p => p.role as Role);

  const gameState = initializeGame({
    ...room.gameConfig,
    playerRole: humanRoles[0],
  });

  store.gameStates.set(roomId, {
    roomId,
    stateJson: gameState,
    currentWeek: gameState.currentWeek,
    roundVersion: 1,
    isGameOver: false,
    updatedAt: now(),
  });

  room.status = 'playing';
  room.updatedAt = now();

  // Start round timer
  startRoundTimer(roomId, gameState.currentWeek, room.gameConfig);

  persistStore();
  return gameState;
}

function startRoundTimer(roomId: string, round: number, gameConfig: GameConfig): void {
  const store = getStore();
  const durationSeconds = getRoundDurationSeconds(round, gameConfig);
  const startedAtMs = Date.now();
  const endsAtMs = startedAtMs + durationSeconds * 1000;

  store.roundTimers.set(roomId, {
    roomId,
    round,
    durationSeconds,
    startedAtMs,
    endsAtMs,
  });
}

export function submitOrder(roomId: string, sessionToken: string, quantity: number): void {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');

  const player = store.roomPlayers.find(p => p.roomId === roomId && p.sessionToken === sessionToken);
  if (!player || !player.role) throw new Error('Player not in game or has no role');

  const role = player.role;
  if (!ALL_ROLES.includes(role)) throw new Error('Invalid role');

  // Remove any existing order for this role, add submitted one
  store.pendingOrders = store.pendingOrders.filter(
    o => !(o.roomId === roomId && o.role === role)
  );
  store.pendingOrders.push({
    roomId,
    role,
    quantity: Math.max(0, quantity),
    isDraft: false,
    updatedAt: now(),
  });

  checkAndResolveRound(roomId);
  persistStore();
}

export function updateDraft(roomId: string, sessionToken: string, quantity: number): void {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');

  const player = store.roomPlayers.find(p => p.roomId === roomId && p.sessionToken === sessionToken);
  if (!player || !player.role) throw new Error('Player not in game');

  const role = player.role;

  // Only update if there is no submitted order
  const existing = store.pendingOrders.find(o => o.roomId === roomId && o.role === role);
  if (existing && !existing.isDraft) return;

  // Remove old draft, add new one
  store.pendingOrders = store.pendingOrders.filter(
    o => !(o.roomId === roomId && o.role === role)
  );
  store.pendingOrders.push({
    roomId,
    role,
    quantity: Math.max(0, quantity),
    isDraft: true,
    updatedAt: now(),
  });
}

export function getGamePoll(roomId: string, sessionToken: string, sinceVersion?: number): GamePollResponse | null {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');

  // Check expired timer
  checkAndResolveRound(roomId);

  const gs = store.gameStates.get(roomId);
  if (!gs) return null;

  if (sinceVersion && gs.roundVersion <= sinceVersion) {
    return null; // No change
  }

  const gameState = gs.stateJson;
  const player = store.roomPlayers.find(p => p.roomId === roomId && p.sessionToken === sessionToken);
  const myRole = player?.role as Role;
  if (!myRole) return null;

  // Update poll timestamp
  if (player) {
    player.lastPoll = now();
    player.isConnected = true;
  }

  const submitted = store.pendingOrders
    .filter(o => o.roomId === roomId && !o.isDraft)
    .map(o => o.role);

  const timer = store.roundTimers.get(roomId);

  return {
    currentWeek: gameState.currentWeek,
    totalWeeks: gameState.totalWeeks,
    myStage: gameState.stages[myRole],
    myHistory: gameState.history[myRole],
    isGameOver: gameState.isGameOver,
    timer: timer ? {
      round: timer.round,
      durationSeconds: timer.durationSeconds,
      startedAtMs: timer.startedAtMs,
      endsAtMs: timer.endsAtMs,
    } : null,
    submittedRoles: submitted,
    roundVersion: gs.roundVersion,
  };
}

export function getGameResults(roomId: string): GameResultsResponse | null {
  const store = getStore();
  const gs = store.gameStates.get(roomId);
  if (!gs) return null;

  const gameState = gs.stateJson;
  if (!gameState.isGameOver) return null;

  return {
    gameState,
    bullwhipRatios: calculateBullwhipRatio(gameState.history),
  };
}

export function getAuthorizedGameResults(roomId: string, sessionToken: string): GameResultsResponse | null {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) {
    return null;
  }

  const allowed = room.hostToken === sessionToken
    || store.roomPlayers.some(player => player.roomId === roomId && player.sessionToken === sessionToken);

  if (!allowed) {
    throw new Error('Access denied');
  }

  return getGameResults(roomId);
}

export function getFullGameState(roomId: string): GameState | null {
  const store = getStore();
  const gs = store.gameStates.get(roomId);
  return gs?.stateJson || null;
}

function checkAndResolveRound(roomId: string): void {
  const store = getStore();

  const gs = store.gameStates.get(roomId);
  if (!gs || gs.isGameOver) return;

  const gameState = gs.stateJson;
  if (gameState.isGameOver) return;

  const timer = store.roundTimers.get(roomId);
  const timerExpired = timer && Date.now() >= timer.endsAtMs;

  // Human players with roles
  markDisconnectedPlayers(roomId);
  const humanPlayers = store.roomPlayers.filter(
    p => p.roomId === roomId && p.role && p.isConnected
  );
  const humanRoles = humanPlayers.map(p => p.role as Role);

  // Submitted orders
  const submittedOrders = store.pendingOrders.filter(
    o => o.roomId === roomId && !o.isDraft
  );
  const submittedRoles = new Set(submittedOrders.map(o => o.role));

  const allSubmitted = humanRoles.every(r => submittedRoles.has(r));

  if (!allSubmitted && !timerExpired) return;

  // If timer expired, finalize missing orders
  if (timerExpired && !allSubmitted) {
    for (const role of humanRoles) {
      if (submittedRoles.has(role)) continue;

      const draft = store.pendingOrders.find(
        o => o.roomId === roomId && o.role === role && o.isDraft
      );
      const fallbackQty = draft ? draft.quantity : gameState.stages[role].lastOrderPlaced;

      // Remove old entry and add submitted
      store.pendingOrders = store.pendingOrders.filter(
        o => !(o.roomId === roomId && o.role === role)
      );
      store.pendingOrders.push({
        roomId,
        role,
        quantity: Math.max(0, fallbackQty),
        isDraft: false,
        updatedAt: now(),
      });
    }
  }

  // Build orders map
  const allOrders = store.pendingOrders.filter(
    o => o.roomId === roomId && !o.isDraft
  );
  const orders: Partial<Record<Role, number>> = {};
  for (const o of allOrders) {
    orders[o.role] = o.quantity;
  }

  // Advance the game
  const savedVersion = gs.roundVersion;
  const newState = advanceWeekMultiplayer(gameState, orders);

  // Update store (check for race condition)
  if (gs.roundVersion !== savedVersion) return;

  gs.stateJson = newState;
  gs.currentWeek = newState.currentWeek;
  gs.roundVersion++;
  gs.isGameOver = newState.isGameOver;
  gs.updatedAt = now();

  // Clear pending orders for this room
  store.pendingOrders = store.pendingOrders.filter(o => o.roomId !== roomId);

  // Clear timer
  store.roundTimers.delete(roomId);

  if (newState.isGameOver) {
    const room = store.rooms.get(roomId);
    if (room) {
      room.status = 'finished';
      room.updatedAt = now();
    }
  } else {
    // Start new timer
    const room = store.rooms.get(roomId);
    if (room) {
      startRoundTimer(roomId, newState.currentWeek, room.gameConfig);
    }
  }

  persistStore();
}

/**
 * Sweep all active games for expired timers.
 */
export function sweepExpiredTimers(): void {
  const store = getStore();
  const nowMs = Date.now();

  for (const [roomId, timer] of store.roundTimers) {
    if (timer.endsAtMs < nowMs) {
      const gs = store.gameStates.get(roomId);
      if (gs && !gs.isGameOver) {
        try {
          checkAndResolveRound(roomId);
        } catch {
          // Swallow individual room errors
        }
      }
    }
  }
}
