import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { GameConfig, GameState, Role, RoomControllerMode, RoomStatus } from '../../shared/dist/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// --- In-Memory Data Structures ---

export interface SessionRecord {
  token: string;
  playerName: string;
  createdAt: string;
  lastSeen: string;
}

export interface RoomRecord {
  id: string;
  passwordHash: string | null;
  hostToken: string;
  label: string | null;
  controllerMode: RoomControllerMode;
  gameConfig: GameConfig;
  anonymousMode: boolean;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoomPlayerRecord {
  roomId: string;
  sessionToken: string;
  role: Role | null;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: string;
  lastPoll: string;
}

export interface GameStateRecord {
  roomId: string;
  stateJson: GameState;
  currentWeek: number;
  roundVersion: number;
  isGameOver: boolean;
  updatedAt: string;
}

export interface PendingOrderRecord {
  roomId: string;
  role: Role;
  quantity: number;
  isDraft: boolean;
  updatedAt: string;
}

export interface RoundTimerRecord {
  roomId: string;
  round: number;
  durationSeconds: number;
  startedAtMs: number;
  endsAtMs: number;
}

export interface Store {
  sessions: Map<string, SessionRecord>;
  rooms: Map<string, RoomRecord>;
  roomPlayers: RoomPlayerRecord[];
  gameStates: Map<string, GameStateRecord>;
  pendingOrders: PendingOrderRecord[];
  roundTimers: Map<string, RoundTimerRecord>;
}

let store: Store;

export function getStore(): Store {
  if (!store) {
    throw new Error('Store not initialized. Call initStore() first.');
  }
  return store;
}

export function initStore(): Store {
  // Try to load from disk
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      const normalizedRooms = Object.fromEntries(
        Object.entries(raw.rooms || {}).map(([roomId, room]: [string, any]) => [
          roomId,
          {
            ...room,
            passwordHash: room.passwordHash || null,
            label: room.label || null,
            controllerMode: room.controllerMode || 'player',
            status: room.status || 'lobby',
          } satisfies RoomRecord,
        ])
      );
      store = {
        sessions: new Map(Object.entries(raw.sessions || {})),
        rooms: new Map(Object.entries(normalizedRooms)),
        roomPlayers: raw.roomPlayers || [],
        gameStates: new Map(Object.entries(raw.gameStates || {})),
        pendingOrders: raw.pendingOrders || [],
        roundTimers: new Map(Object.entries(raw.roundTimers || {})),
      };
      return store;
    }
  } catch {
    // Ignore load errors, start fresh
  }

  store = {
    sessions: new Map(),
    rooms: new Map(),
    roomPlayers: [],
    gameStates: new Map(),
    pendingOrders: [],
    roundTimers: new Map(),
  };
  return store;
}

export function persistStore(): void {
  if (!store) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serializable = {
      sessions: Object.fromEntries(store.sessions),
      rooms: Object.fromEntries(store.rooms),
      roomPlayers: store.roomPlayers,
      gameStates: Object.fromEntries(store.gameStates),
      pendingOrders: store.pendingOrders,
      roundTimers: Object.fromEntries(store.roundTimers),
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(serializable, null, 2));
  } catch {
    // Ignore persistence errors
  }
}
