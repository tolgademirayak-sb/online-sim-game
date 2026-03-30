// Beer Game Supply Chain Types

export type Role = 'retailer' | 'wholesaler' | 'distributor' | 'factory';

export type DemandPattern = 'constant' | 'random' | 'spike' | 'seasonal';

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
}

export const ROLE_LABELS: Record<Role, string> = {
  retailer: 'Retailer',
  wholesaler: 'Wholesaler',
  distributor: 'Distributor',
  factory: 'Factory',
};

export const ROLE_COLORS: Record<Role, string> = {
  retailer: 'hsl(var(--primary))',
  wholesaler: 'hsl(var(--accent))',
  distributor: 'hsl(var(--chart-shipments))',
  factory: 'hsl(var(--success))',
};

export const SUPPLY_CHAIN_ORDER: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

export const DEFAULT_DEMAND_CONFIG: DemandConfig = {
  baseDemand: 4,
  spikeWeek: 5,
  spikeAmount: 8,
  randomMin: 2,
  randomMax: 8,
};

export const DEFAULT_CONFIG: GameConfig = {
  totalWeeks: 50,
  playerRole: 'retailer',
  demandPattern: 'constant',
  demandConfig: DEFAULT_DEMAND_CONFIG,
  initialInventory: 12,
  inventoryCostPerUnit: 0.5,
  backlogCostPerUnit: 1.0,
  orderDelay: 2,
  shipmentDelay: 2,
};
