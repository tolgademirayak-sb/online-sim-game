// Re-export shared API types for frontend consumption
// These types are defined in shared/src/types.ts and used by apiService.ts

import type {
  Role,
  GameConfig,
  GameState,
  StageState,
  WeeklyRecord,
  TimerConfig,
  DemandConfig,
  DemandPattern,
  RoomControllerMode,
  RoomStatus,
} from '@/types/game';

export type {
  Role,
  GameConfig,
  GameState,
  StageState,
  WeeklyRecord,
  TimerConfig,
  DemandConfig,
  DemandPattern,
  RoomControllerMode,
  RoomStatus,
};

// API response types

export interface RoomPlayer {
  sessionToken: string;
  name: string;
  role?: Role;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
}

export interface RoomStateResponse {
  roomId: string;
  label: string | null;
  players: RoomPlayer[];
  gameConfig: GameConfig;
  anonymousMode: boolean;
  status: RoomStatus;
  controllerMode: RoomControllerMode;
  joinPasswordRequired: boolean;
  timerState: RoundTimerState | null;
}

export interface RoundTimerState {
  round: number;
  durationSeconds: number;
  startedAtMs: number;
  endsAtMs: number;
}

export interface GamePollResponse {
  currentWeek: number;
  totalWeeks: number;
  myStage: StageState;
  myHistory: WeeklyRecord[];
  isGameOver: boolean;
  timer: RoundTimerState | null;
  submittedRoles: Role[];
  roundVersion: number;
}

export interface GameResultsResponse {
  gameState: GameState;
  bullwhipRatios: Record<Role, number>;
}

export interface AdminRoomSummary {
  id: string;
  status: RoomStatus;
  playerCount: number;
  currentWeek: number;
  totalWeeks: number;
  createdAt: string;
}

export interface AdminStatsResponse {
  totalRooms: number;
  activeGames: number;
  completedGames: number;
  lobbies: number;
  totalPlayers: number;
}

export interface SessionInfoResponse {
  token: string;
  playerName: string;
}

export interface InstructorRoomSummary {
  roomId: string;
  label: string | null;
  status: RoomStatus;
  controllerMode: RoomControllerMode;
  playerCount: number;
  connectedCount: number;
  currentWeek: number;
  totalWeeks: number;
  anonymousMode: boolean;
  joinPasswordRequired: boolean;
  createdAt: string;
  updatedAt: string;
}
