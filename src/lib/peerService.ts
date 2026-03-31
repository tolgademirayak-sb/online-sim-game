import Peer, { DataConnection } from 'peerjs';
import { Role, GameState, GameConfig, DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG, TimerConfig } from '@/types/game';
import { initializeGame, advanceWeekMultiplayer, calculateAIOrder } from '@/lib/gameLogic';

// ============================================================
// PeerJS P2P Service for Multiplayer Beer Game
// ============================================================
// Host = Server — runs game logic, broadcasts state
// Clients = Players — send orders, receive state
// ============================================================

export interface MultiplayerPlayer {
  id: string;
  name: string;
  role?: Role;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
}

export interface RoomState {
  roomId: string;
  players: MultiplayerPlayer[];
  availableRoles: Role[];
  gameConfig?: GameConfig;
  anonymousMode: boolean;
  timerState: RoundTimerState | null;
  isGameStarted: boolean;
}

export interface RoundTimerState {
  round: number;
  durationSeconds: number;
  startedAtMs: number;
  endsAtMs: number;
  isActive: boolean;
}

// --- Message Protocol ---
export type P2PMessageType =
  // Client → Host
  | 'JOIN_ROOM'
  | 'SELECT_ROLE'
  | 'PLAYER_READY'
  | 'UPDATE_DRAFT_ORDER'
  | 'SUBMIT_ORDER'
  // Host → Client
  | 'ROOM_JOINED'
  | 'ROOM_STATE'
  | 'GAME_STARTED'
  | 'GAME_STATE'
  | 'GAME_OVER'
  | 'ERROR'
  | 'PLAYER_DISCONNECTED'
  | 'HOST_DISCONNECTED';

export interface P2PMessage {
  type: P2PMessageType;
  payload: any;
}

type MessageHandler = (message: P2PMessage) => void;

// All four roles
const ALL_ROLES: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

// Generate short room ID
function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I/O/0/1
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

class PeerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private handlers: Map<P2PMessageType, MessageHandler[]> = new Map();

  // Host state
  private _isHost = false;
  private roomPassword = '';
  private roomId = '';
  private players: MultiplayerPlayer[] = [];
  private gameState: GameState | null = null;
  private gameConfig: GameConfig = { ...DEFAULT_CONFIG, demandConfig: { ...DEFAULT_DEMAND_CONFIG } };
  private pendingOrders: Map<Role, number> = new Map();
  private occupiedRoles: Set<Role> = new Set();
  private currentRoomState: RoomState | null = null;
  private anonymousMode = false;
  private draftOrders: Map<Role, number> = new Map();
  private timerState: RoundTimerState | null = null;
  private roundTimerHandle: ReturnType<typeof setTimeout> | null = null;
  private isResolvingRound = false;

  // Client state
  private _isConnected = false;
  private hostConnection: DataConnection | null = null;

  get isHost() { return this._isHost; }
  get isConnected() { return this._isConnected; }

  private shuffleRoles(roles: Role[]): Role[] {
    const shuffled = [...roles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private syncOccupiedRoles() {
    this.occupiedRoles = new Set(
      this.players
        .map(player => player.role)
        .filter((role): role is Role => role !== undefined)
    );
  }

  private autoAssignRoles() {
    if (this.gameState) return;

    const usedRoles = new Set<Role>();
    const unassignedPlayers: MultiplayerPlayer[] = [];

    this.players.forEach((player) => {
      if (player.role && !usedRoles.has(player.role)) {
        usedRoles.add(player.role);
      } else {
        player.role = undefined;
        unassignedPlayers.push(player);
      }
    });

    const availableRoles = this.shuffleRoles(
      ALL_ROLES.filter(role => !usedRoles.has(role))
    );

    unassignedPlayers.forEach((player, index) => {
      player.role = availableRoles[index];
    });

    this.syncOccupiedRoles();
  }

  private getTimerConfig(): TimerConfig {
    return this.gameConfig.timerConfig || DEFAULT_CONFIG.timerConfig;
  }

  private getRoundDurationSeconds(round: number): number {
    const timerConfig = this.getTimerConfig();
    const finalRoundsStart = Math.max(1, this.gameConfig.totalWeeks - timerConfig.finalRounds + 1);

    if (round <= timerConfig.earlyRounds) {
      return timerConfig.earlyRoundDurationSec;
    }

    if (round >= finalRoundsStart) {
      return timerConfig.finalRoundDurationSec;
    }

    return timerConfig.middleRoundDurationSec;
  }

  private clearRoundTimer() {
    if (this.roundTimerHandle) {
      clearTimeout(this.roundTimerHandle);
      this.roundTimerHandle = null;
    }
    this.timerState = null;
  }

  private startRoundTimer() {
    if (!this.gameState || this.gameState.isGameOver) return;

    this.clearRoundTimer();

    const durationSeconds = this.getRoundDurationSeconds(this.gameState.currentWeek);
    const startedAtMs = Date.now();
    const endsAtMs = startedAtMs + durationSeconds * 1000;

    this.timerState = {
      round: this.gameState.currentWeek,
      durationSeconds,
      startedAtMs,
      endsAtMs,
      isActive: true,
    };

    this.broadcastRoomState();

    this.roundTimerHandle = setTimeout(() => {
      this.handleRoundTimeout(this.gameState?.currentWeek || 0);
    }, durationSeconds * 1000);
  }

  private resolveCurrentRound(finalizeMissingOrders = false) {
    if (!this.gameState || this.gameState.isGameOver || this.isResolvingRound) return;

    const humanRoles = this.players
      .filter(player => player.role && player.isConnected)
      .map(player => player.role!);

    if (finalizeMissingOrders) {
      humanRoles.forEach((role) => {
        if (!this.pendingOrders.has(role)) {
          const fallbackOrder = this.draftOrders.get(role) ?? this.gameState!.stages[role].lastOrderPlaced;
          this.pendingOrders.set(role, Math.max(0, fallbackOrder));
        }
      });
    }

    const allSubmitted = humanRoles.every(role => this.pendingOrders.has(role));
    if (!allSubmitted) return;

    this.isResolvingRound = true;
    this.clearRoundTimer();

    const orders: Partial<Record<Role, number>> = {};
    this.pendingOrders.forEach((qty, role) => {
      orders[role] = qty;
    });

    this.gameState = advanceWeekMultiplayer(this.gameState, orders);
    this.pendingOrders.clear();
    this.draftOrders.clear();

    if (this.gameState.isGameOver) {
      const msg: P2PMessage = { type: 'GAME_OVER', payload: { gameState: this.gameState } };
      this.broadcastToClients(msg);
      this.dispatch(msg);
      this.broadcastRoomState();
    } else {
      const msg: P2PMessage = { type: 'GAME_STATE', payload: this.gameState };
      this.broadcastToClients(msg);
      this.dispatch(msg);
      this.startRoundTimer();
    }

    this.isResolvingRound = false;
  }

  private handleRoundTimeout(expectedRound: number) {
    if (!this.gameState || this.gameState.currentWeek !== expectedRound || this.gameState.isGameOver) {
      return;
    }

    this.resolveCurrentRound(true);
  }

  // ========== HOST METHODS ==========

  createRoom(password: string, hostName: string, gameConfig?: Partial<GameConfig>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      this._isHost = true;
      this.roomPassword = password;
      this.roomId = generateRoomId();
      this.anonymousMode = false;

      if (gameConfig) {
        this.gameConfig = {
          ...DEFAULT_CONFIG,
          ...gameConfig,
          demandConfig: { ...DEFAULT_DEMAND_CONFIG, ...(gameConfig.demandConfig || {}) },
          timerConfig: { ...DEFAULT_CONFIG.timerConfig, ...(gameConfig.timerConfig || {}) },
        };
      }

      // Create peer with the room ID as a prefix for easy identification
      const peerId = `beergame-${this.roomId}`;
      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        console.log('[P2P Host] Room created, Peer ID:', id, 'Room ID:', this.roomId);

        // Add host as first player
        this.players = [{
          id: 'host',
          name: hostName,
          role: undefined,
          isReady: false,
          isHost: true,
          isConnected: true,
        }];
        this.autoAssignRoles();

        this._isConnected = true;
        this.broadcastRoomState();
        resolve(this.roomId);
      });

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[P2P Host] Error:', err);
        if (err.type === 'unavailable-id') {
          // Room ID collision, try again
          this.roomId = generateRoomId();
          this.cleanup();
          this.createRoom(password, hostName, gameConfig).then(resolve).catch(reject);
        } else {
          reject(new Error(`Failed to create room: ${err.message}`));
        }
      });

      this.peer.on('disconnected', () => {
        console.warn('[P2P Host] Disconnected from signaling server');
      });
    });
  }

  private handleIncomingConnection(conn: DataConnection) {
    console.log('[P2P Host] Incoming connection:', conn.peer);

    conn.on('open', () => {
      // Wait for JOIN_ROOM message with password
      conn.on('data', (rawData) => {
        const data = rawData as P2PMessage;
        this.handleHostMessage(conn, data);
      });
    });

    conn.on('close', () => {
      this.handlePlayerDisconnect(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('[P2P Host] Connection error:', err);
      this.handlePlayerDisconnect(conn.peer);
    });
  }

  private handleHostMessage(conn: DataConnection, message: P2PMessage) {
    console.log('[P2P Host] Received:', message.type, message.payload);

    switch (message.type) {
      case 'JOIN_ROOM': {
        const { password, playerName } = message.payload;

        // Validate password
        if (password !== this.roomPassword) {
          this.sendTo(conn, { type: 'ERROR', payload: { message: 'Invalid password' } });
          conn.close();
          return;
        }

        // Check player limit
        if (this.players.length >= 4) {
          this.sendTo(conn, { type: 'ERROR', payload: { message: 'Room is full (4/4)' } });
          conn.close();
          return;
        }

        // Check if game already started
        if (this.gameState) {
          this.sendTo(conn, { type: 'ERROR', payload: { message: 'Game already in progress' } });
          conn.close();
          return;
        }

        // Add player
        const player: MultiplayerPlayer = {
          id: conn.peer,
          name: playerName,
          role: undefined,
          isReady: false,
          isHost: false,
          isConnected: true,
        };
        this.players.push(player);
        this.connections.set(conn.peer, conn);
        this.autoAssignRoles();

        // Send ROOM_JOINED to the new player
        this.sendTo(conn, {
          type: 'ROOM_JOINED',
          payload: { roomId: this.roomId, players: this.players },
        });

        // Broadcast room state to all
        this.broadcastRoomState();
        break;
      }

      case 'SELECT_ROLE': {
        this.sendTo(conn, { type: 'ERROR', payload: { message: 'Only the host can change roles' } });
        break;
      }

      case 'PLAYER_READY': {
        const player = this.players.find(p => p.id === conn.peer);
        if (player) {
          player.isReady = true;
          this.broadcastRoomState();
        }
        break;
      }

      case 'UPDATE_DRAFT_ORDER': {
        const { role, quantity } = message.payload as { role: Role; quantity: number };
        this.draftOrders.set(role, Math.max(0, quantity));
        break;
      }

      case 'SUBMIT_ORDER': {
        const { role, quantity } = message.payload as { role: Role; week: number; quantity: number };
        this.pendingOrders.set(role, Math.max(0, quantity));
        this.draftOrders.set(role, Math.max(0, quantity));
        this.resolveCurrentRound();
        break;
      }
    }
  }

  assignRole(playerId: string, role: Role): boolean {
    if (!this._isHost || this.gameState) return false;

    const targetPlayer = this.players.find(player => player.id === playerId);
    if (!targetPlayer) return false;

    const currentHolder = this.players.find(player => player.id !== playerId && player.role === role);
    const previousRole = targetPlayer.role;

    targetPlayer.role = role;

    if (currentHolder) {
      currentHolder.role = previousRole;
    }

    this.syncOccupiedRoles();
    this.broadcastRoomState();
    return true;
  }

  updateTimerConfig(patch: Partial<TimerConfig>): boolean {
    if (!this._isHost || this.gameState) return false;

    const current = this.getTimerConfig();
    this.gameConfig = {
      ...this.gameConfig,
      timerConfig: {
        ...current,
        ...patch,
        earlyRounds: Math.max(0, patch.earlyRounds ?? current.earlyRounds),
        finalRounds: Math.max(0, patch.finalRounds ?? current.finalRounds),
        earlyRoundDurationSec: Math.max(5, patch.earlyRoundDurationSec ?? current.earlyRoundDurationSec),
        middleRoundDurationSec: Math.max(5, patch.middleRoundDurationSec ?? current.middleRoundDurationSec),
        finalRoundDurationSec: Math.max(5, patch.finalRoundDurationSec ?? current.finalRoundDurationSec),
      },
    };

    this.broadcastRoomState();
    return true;
  }

  setAnonymousMode(enabled: boolean): boolean {
    if (!this._isHost || this.gameState) return false;
    this.anonymousMode = enabled;
    this.broadcastRoomState();
    return true;
  }

  // Host sets ready
  hostSetReady() {
    const hostPlayer = this.players.find(p => p.isHost);
    if (hostPlayer) {
      hostPlayer.isReady = true;
      this.broadcastRoomState();
    }
  }

  // Host submits order
  hostSubmitOrder(role: Role, quantity: number) {
    this.pendingOrders.set(role, Math.max(0, quantity));
    this.draftOrders.set(role, Math.max(0, quantity));
    this.resolveCurrentRound();
  }

  updateDraftOrder(role: Role, quantity: number) {
    if (this._isHost) {
      this.draftOrders.set(role, Math.max(0, quantity));
      return;
    }

    this.sendToHost({ type: 'UPDATE_DRAFT_ORDER', payload: { role, quantity } });
  }

  // Host starts game
  startGame() {
    if (!this._isHost) return;

    this.autoAssignRoles();

    // All connected players must be ready and have roles
    const readyPlayers = this.players.filter(p => p.isReady && p.role);
    if (readyPlayers.length < 2) return;

    // Get human-occupied roles
    const humanRoles = readyPlayers.map(p => p.role!);

    // Initialize game — use first human role as playerRole (for compatibility)
    this.gameState = initializeGame({
      ...this.gameConfig,
      playerRole: humanRoles[0],
    });

    // Broadcast game started
    const startMsg: P2PMessage = {
      type: 'GAME_STARTED',
      payload: { gameState: this.gameState },
    };
    this.broadcastToClients(startMsg);

    // Also dispatch locally for host UI
    this.dispatch(startMsg);
    this.broadcastRoomState();
    this.startRoundTimer();
  }

  private handlePlayerDisconnect(peerId: string) {
    const player = this.players.find(p => p.id === peerId);
    if (!player) return;

    player.isConnected = false;
    if (player.role) {
      this.occupiedRoles.delete(player.role);
    }
    this.connections.delete(peerId);

    // Notify others
    const msg: P2PMessage = {
      type: 'PLAYER_DISCONNECTED',
      payload: { playerName: player.name, role: player.role },
    };
    this.broadcastToClients(msg);
    this.dispatch(msg);

    // Remove from players list
    this.players = this.players.filter(p => p.id !== peerId);
    this.autoAssignRoles();
    this.broadcastRoomState();

    // If game is in progress and player had a role, try advance with AI
    if (this.gameState && !this.gameState.isGameOver) {
      this.resolveCurrentRound(true);
    }
  }

  private broadcastRoomState() {
    const availableRoles = ALL_ROLES.filter(r => !this.occupiedRoles.has(r));
    const roomState: RoomState = {
      roomId: this.roomId,
      players: this.players,
      availableRoles,
      gameConfig: this.gameConfig,
      anonymousMode: this.anonymousMode,
      timerState: this.timerState,
      isGameStarted: !!this.gameState,
    };
    this.currentRoomState = roomState;

    const msg: P2PMessage = { type: 'ROOM_STATE', payload: roomState };
    this.broadcastToClients(msg);
    this.dispatch(msg); // also update host UI
  }

  private broadcastToClients(message: P2PMessage) {
    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(message);
      }
    });
  }

  private sendTo(conn: DataConnection, message: P2PMessage) {
    if (conn.open) {
      conn.send(message);
    }
  }

  // ========== CLIENT METHODS ==========

  joinRoom(roomId: string, password: string, playerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      this._isHost = false;
      this.roomId = roomId;

      // Create a peer for this client
      this.peer = new Peer();

      this.peer.on('open', () => {
        // Connect to host
        const hostPeerId = `beergame-${roomId}`;
        const conn = this.peer!.connect(hostPeerId, { reliable: true });

        conn.on('open', () => {
          console.log('[P2P Client] Connected to host');
          this.hostConnection = conn;
          this._isConnected = true;

          // Listen for messages from host
          conn.on('data', (rawData) => {
            const data = rawData as P2PMessage;
            console.log('[P2P Client] Received:', data.type);

            if (data.type === 'ROOM_JOINED' || data.type === 'ROOM_STATE') {
              this.currentRoomState = data.payload as RoomState;
            }

            this.dispatch(data);

            // Resolve on ROOM_JOINED
            if (data.type === 'ROOM_JOINED') {
              resolve();
            }
            // Reject on ERROR during join
            if (data.type === 'ERROR') {
              reject(new Error(data.payload.message));
            }
          });

          // Send join request
          this.sendToHost({
            type: 'JOIN_ROOM',
            payload: { password, playerName },
          });
        });

        conn.on('close', () => {
          console.log('[P2P Client] Disconnected from host');
          this._isConnected = false;
          this.dispatch({ type: 'HOST_DISCONNECTED', payload: {} });
        });

        conn.on('error', (err) => {
          console.error('[P2P Client] Connection error:', err);
          reject(new Error('Failed to connect to room'));
        });
      });

      this.peer.on('error', (err) => {
        console.error('[P2P Client] Peer error:', err);
        if (err.type === 'peer-unavailable') {
          reject(new Error('Room not found. Check the Room ID and try again.'));
        } else {
          reject(new Error(`Connection failed: ${err.message}`));
        }
      });
    });
  }

  // Client sends role selection to host
  selectRole(role: Role) {
    if (this._isHost || this.gameState) return;
    this.sendToHost({ type: 'SELECT_ROLE', payload: { role } });
  }

  // Client sends ready to host
  setReady() {
    if (this._isHost) {
      this.hostSetReady();
    } else {
      this.sendToHost({ type: 'PLAYER_READY', payload: {} });
    }
  }

  // Client submits order
  submitOrder(role: Role, week: number, quantity: number) {
    if (this._isHost) {
      this.hostSubmitOrder(role, quantity);
    } else {
      this.sendToHost({ type: 'SUBMIT_ORDER', payload: { role, week, quantity } });
    }
  }

  private sendToHost(message: P2PMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(message);
      console.log('[P2P Client] Sent:', message.type);
    } else {
      console.warn('[P2P Client] Not connected to host');
    }
  }

  // ========== STATE ACCESSORS ==========

  /** Get current room state snapshot (for initial UI render) */
  getCurrentRoomState(): RoomState | null {
    if (this.currentRoomState) {
      return this.currentRoomState;
    }

    if (!this._isConnected && !this._isHost) return null;
    if (this.players.length === 0) return null;

    const availableRoles = ALL_ROLES.filter(r => !this.occupiedRoles.has(r));
    return {
      roomId: this.roomId,
      players: [...this.players],
      availableRoles,
      gameConfig: this.gameConfig,
      anonymousMode: this.anonymousMode,
      timerState: this.timerState,
      isGameStarted: !!this.gameState,
    };
  }

  // ========== EVENT SYSTEM ==========

  on(type: P2PMessageType, handler: MessageHandler): () => void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);

    return () => {
      const handlers = this.handlers.get(type) || [];
      this.handlers.set(type, handlers.filter(h => h !== handler));
    };
  }

  private dispatch(message: P2PMessage) {
    const handlers = this.handlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));
  }

  // ========== CLEANUP ==========

  cleanup() {
    // Close all connections
    this.connections.forEach(conn => {
      if (conn.open) conn.close();
    });
    this.connections.clear();

    // Close host connection
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.close();
    }
    this.hostConnection = null;

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Reset state
    this._isHost = false;
    this._isConnected = false;
    this.players = [];
    this.gameState = null;
    this.pendingOrders.clear();
    this.occupiedRoles.clear();
    this.currentRoomState = null;
    this.anonymousMode = false;
    this.draftOrders.clear();
    this.clearRoundTimer();
    this.isResolvingRound = false;
    this.handlers.clear();
    this.roomPassword = '';
    this.roomId = '';
  }
}

// Singleton
export const peerService = new PeerService();
