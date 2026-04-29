import crypto from 'crypto';
import { getStore, persistStore, type RoomPlayerRecord } from '../db.js';
import type { Role, GameConfig, RoomPlayer, RoomStateResponse, InstructorRoomSummary, RoomControllerMode } from '../../../shared/dist/types.js';

const ALL_ROLES: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function now(): string {
  return new Date().toISOString();
}

function getRoomPlayers(roomId: string): RoomPlayerRecord[] {
  return getStore().roomPlayers.filter(p => p.roomId === roomId);
}

function ensureRoomAccess(roomId: string, sessionToken: string): { isController: boolean } {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  const isController = room.hostToken === sessionToken;
  const isParticipant = getRoomPlayers(roomId).some(p => p.sessionToken === sessionToken);

  if (!isController && !isParticipant) {
    throw new Error('Access denied');
  }

  return { isController };
}

function sanitizePlayersForViewer(roomId: string, sessionToken: string, anonymousMode: boolean): RoomPlayer[] {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  const players = getRoomPlayers(roomId);
  const isController = room.hostToken === sessionToken;

  return players.map((p, index) => {
    const originalName = store.sessions.get(p.sessionToken)?.playerName || 'Unknown';
    const maskedName = anonymousMode && !isController && p.sessionToken !== sessionToken
      ? `Player ${index + 1}`
      : originalName;

    return {
      sessionToken: p.sessionToken,
      name: maskedName,
      role: p.role || undefined,
      isHost: p.isHost,
      isReady: p.isReady,
      isConnected: p.isConnected,
    };
  });
}

export function markDisconnectedPlayers(roomId: string, staleAfterMs = 15000): void {
  const cutoff = Date.now() - staleAfterMs;
  for (const player of getRoomPlayers(roomId)) {
    if (player.isConnected && new Date(player.lastPoll).getTime() < cutoff) {
      player.isConnected = false;
    }
  }
}

export function createRoom(
  hostToken: string,
  password: string | undefined,
  gameConfig: GameConfig,
  options?: { label?: string; controllerMode?: RoomControllerMode; skipSeat?: boolean }
): string {
  const store = getStore();

  let roomId: string;
  let attempts = 0;
  do {
    roomId = generateRoomId();
    if (!store.rooms.has(roomId)) break;
    attempts++;
  } while (attempts < 50);

  if (attempts >= 50) throw new Error('Could not generate unique room ID');

  store.rooms.set(roomId, {
    id: roomId,
    passwordHash: password?.trim() ? hashPassword(password.trim()) : null,
    hostToken,
    label: options?.label?.trim() ? options.label.trim().slice(0, 48) : null,
    controllerMode: options?.controllerMode || 'player',
    gameConfig,
    anonymousMode: false,
    status: 'lobby',
    createdAt: now(),
    updatedAt: now(),
  });

  if (!options?.skipSeat) {
    store.roomPlayers.push({
      roomId,
      sessionToken: hostToken,
      role: null,
      isHost: true,
      isReady: false,
      isConnected: true,
      joinedAt: now(),
      lastPoll: now(),
    });
  }

  autoAssignRoles(roomId);
  persistStore();
  return roomId;
}

export function joinRoom(roomId: string, sessionToken: string, password?: string): void {
  const store = getStore();

  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');

  const players = getRoomPlayers(roomId);
  const existing = players.find(p => p.sessionToken === sessionToken);
  if (existing) {
    existing.isConnected = true;
    existing.lastPoll = now();
    persistStore();
    return;
  }

  if (room.status !== 'lobby') throw new Error('Game already in progress');
  if (room.passwordHash && room.passwordHash !== hashPassword(password || '')) throw new Error('Invalid password');
  if (players.length >= 4) throw new Error('Room is full (4/4)');

  store.roomPlayers.push({
    roomId,
    sessionToken,
    role: null,
    isHost: false,
    isReady: false,
    isConnected: true,
    joinedAt: now(),
    lastPoll: now(),
  });

  autoAssignRoles(roomId);
  persistStore();
}

export function leaveRoom(roomId: string, sessionToken: string): void {
  const store = getStore();
  store.roomPlayers = store.roomPlayers.filter(
    p => !(p.roomId === roomId && p.sessionToken === sessionToken)
  );
  autoAssignRoles(roomId);
  persistStore();
}

export function setReady(roomId: string, sessionToken: string): void {
  const player = getRoomPlayers(roomId).find(p => p.sessionToken === sessionToken);
  if (!player) throw new Error('Not in room');
  player.isReady = !player.isReady;
  persistStore();
}

export function updateConfig(roomId: string, sessionToken: string, configPatch: Partial<GameConfig>): void {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== sessionToken) throw new Error('Only host can update config');
  if (room.status !== 'lobby') throw new Error('Cannot change config after game started');

  const current = room.gameConfig;
  room.gameConfig = {
    ...current,
    ...configPatch,
    demandConfig: { ...current.demandConfig, ...(configPatch.demandConfig || {}) },
    timerConfig: { ...current.timerConfig, ...(configPatch.timerConfig || {}) },
  };
  room.updatedAt = now();
  persistStore();
}

export function assignRoles(roomId: string, sessionToken: string, assignments: Record<string, Role>): void {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== sessionToken) throw new Error('Only host can assign roles');
  if (room.status !== 'lobby') throw new Error('Cannot change roles after game started');

  const players = getRoomPlayers(roomId);
  for (const [playerToken, role] of Object.entries(assignments)) {
    if (!ALL_ROLES.includes(role)) continue;
    const player = players.find(p => p.sessionToken === playerToken);
    if (player) player.role = role;
  }
  persistStore();
}

export function setAnonymousMode(roomId: string, sessionToken: string, enabled: boolean): void {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  if (room.hostToken !== sessionToken) throw new Error('Only host can toggle anonymous mode');
  if (room.status !== 'lobby') throw new Error('Cannot change after game started');

  room.anonymousMode = enabled;
  room.updatedAt = now();
  persistStore();
}

export function getRoomState(roomId: string, sessionToken: string): RoomStateResponse {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  ensureRoomAccess(roomId, sessionToken);

  // Update caller's poll timestamp
  const callerPlayer = getRoomPlayers(roomId).find(p => p.sessionToken === sessionToken);
  if (callerPlayer) {
    callerPlayer.lastPoll = now();
    callerPlayer.isConnected = true;
  }

  markDisconnectedPlayers(roomId);
  const timer = store.roundTimers.get(roomId);

  return {
    roomId: room.id,
    label: room.label,
    players: sanitizePlayersForViewer(roomId, sessionToken, room.anonymousMode),
    gameConfig: room.gameConfig,
    anonymousMode: room.anonymousMode,
    status: room.status,
    controllerMode: room.controllerMode,
    joinPasswordRequired: !!room.passwordHash,
    timerState: timer ? {
      round: timer.round,
      durationSeconds: timer.durationSeconds,
      startedAtMs: timer.startedAtMs,
      endsAtMs: timer.endsAtMs,
    } : null,
  };
}

export function isHost(roomId: string, sessionToken: string): boolean {
  const store = getStore();
  const room = store.rooms.get(roomId);
  if (!room) return false;
  return room.hostToken === sessionToken;
}

export function getPlayerRole(roomId: string, sessionToken: string): Role | undefined {
  const player = getRoomPlayers(roomId).find(p => p.sessionToken === sessionToken);
  return player?.role || undefined;
}

function autoAssignRoles(roomId: string): void {
  const players = getRoomPlayers(roomId);
  const usedRoles = new Set<Role>();
  const unassigned: RoomPlayerRecord[] = [];

  for (const p of players) {
    if (p.role && ALL_ROLES.includes(p.role) && !usedRoles.has(p.role)) {
      usedRoles.add(p.role);
    } else {
      p.role = null;
      unassigned.push(p);
    }
  }

  const available = shuffleArray(ALL_ROLES.filter(r => !usedRoles.has(r)));
  unassigned.forEach((p, i) => {
    if (i < available.length) {
      p.role = available[i];
    }
  });
}

export function listOwnedRooms(sessionToken: string): InstructorRoomSummary[] {
  const store = getStore();
  const results: InstructorRoomSummary[] = [];

  for (const room of store.rooms.values()) {
    if (room.hostToken !== sessionToken) {
      continue;
    }

    markDisconnectedPlayers(room.id);
    const players = getRoomPlayers(room.id);
    const gameState = store.gameStates.get(room.id);

    results.push({
      roomId: room.id,
      label: room.label,
      status: room.status,
      controllerMode: room.controllerMode,
      playerCount: players.length,
      connectedCount: players.filter(player => player.isConnected).length,
      currentWeek: gameState?.currentWeek || 0,
      totalWeeks: room.gameConfig.totalWeeks,
      anonymousMode: room.anonymousMode,
      joinPasswordRequired: !!room.passwordHash,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    });
  }

  results.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'playing') return -1;
      if (b.status === 'playing') return 1;
      if (a.status === 'lobby') return -1;
      if (b.status === 'lobby') return 1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  return results;
}
