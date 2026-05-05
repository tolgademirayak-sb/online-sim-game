// Beer Game Supply Chain Types — Shared between server and client

export type Role = 'retailer' | 'wholesaler' | 'distributor' | 'factory';

export type DemandPattern = 'constant' | 'random' | 'spike' | 'seasonal';

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export type RoomControllerMode = 'player' | 'instructor';

export interface DemandConfig {
  baseDemand: number;
  spikeWeek: number;
  spikeAmount: number;
  randomMin: number;
  randomMax: number;
}

export interface StageState {
  role: Role;
  inventory: number;
  backlog: number;
  incomingOrders: number;
  outgoingShipments: number;
  incomingShipments: number;
  lastOrderPlaced: number;
  totalInventoryCost: number;
  totalBacklogCost: number;
  orderPipeline: number[];
  shipmentPipeline: number[];
}

export interface WeeklyRecord {
  week: number;
  inventory: number;
  backlog: number;
  incomingOrders: number;
  orderPlaced: number;
  incomingShipments: number;
  outgoingShipments: number;
  cost: number;
}

export interface GameState {
  currentWeek: number;
  totalWeeks: number;
  playerRole: Role;
  demandPattern: DemandPattern;
  demandConfig: DemandConfig;
  stages: Record<Role, StageState>;
  history: Record<Role, WeeklyRecord[]>;
  customerDemand: number[];
  isGameOver: boolean;
  isStarted: boolean;
  config: GameConfig;
}

export interface GameConfig {
  totalWeeks: number;
  playerRole: Role;
  demandPattern: DemandPattern;
  demandConfig: DemandConfig;
  initialInventory: number;
  inventoryCostPerUnit: number;
  backlogCostPerUnit: number;
  orderDelay: number;
  shipmentDelay: number;
  timerConfig: TimerConfig;
}

export interface TimerConfig {
  earlyRounds: number;
  finalRounds: number;
  earlyRoundDurationSec: number;
  middleRoundDurationSec: number;
  finalRoundDurationSec: number;
}

export const SUPPLY_CHAIN_ORDER: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

export const DEFAULT_DEMAND_CONFIG: DemandConfig = {
  baseDemand: 4,
  spikeWeek: 5,
  spikeAmount: 8,
  randomMin: 2,
  randomMax: 8,
};

export const DEFAULT_CONFIG: GameConfig = {
  totalWeeks: 35,
  playerRole: 'retailer',
  demandPattern: 'constant',
  demandConfig: DEFAULT_DEMAND_CONFIG,
  initialInventory: 12,
  inventoryCostPerUnit: 0.5,
  backlogCostPerUnit: 1.0,
  orderDelay: 2,
  shipmentDelay: 2,
  timerConfig: {
    earlyRounds: 3,
    finalRounds: 5,
    earlyRoundDurationSec: 180,
    middleRoundDurationSec: 120,
    finalRoundDurationSec: 60,
  },
};

// --- API response types used by both server and client ---

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
  classroomId: string | null;
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
  classroomId: string | null;
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

export interface ClassroomRoomSummary extends InstructorRoomSummary {
  teamNumber: number;
}

export interface ClassroomSummary {
  classCode: string;
  label: string;
  roomCount: number;
  capacity: number;
  playerCount: number;
  connectedCount: number;
  status: RoomStatus;
  joinPasswordRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomDetail extends ClassroomSummary {
  rooms: ClassroomRoomSummary[];
}

export interface CreateClassroomPayload {
  label: string;
  roomCount: number;
  password?: string;
  gameConfig?: Partial<GameConfig>;
}

export interface JoinClassroomResponse {
  roomId: string;
  classCode: string;
}

export interface ClassroomTeamAnalysis {
  roomId: string;
  label: string | null;
  teamNumber: number;
  gameState: GameState;
  bullwhipRatios: Record<Role, number>;
}

export interface ClassroomAnalysisResponse {
  classCode: string;
  label: string;
  teams: ClassroomTeamAnalysis[];
}
