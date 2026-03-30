import {
  GameState,
  GameConfig,
  StageState,
  Role,
  WeeklyRecord,
  SUPPLY_CHAIN_ORDER,
  DEFAULT_CONFIG,
  DemandPattern,
  DemandConfig,
  DEFAULT_DEMAND_CONFIG,
} from '@/types/game';

/**
 * Generate customer demand based on the selected pattern and config
 */
export function generateDemand(pattern: DemandPattern, weeks: number, demandConfig: DemandConfig = DEFAULT_DEMAND_CONFIG): number[] {
  const demand: number[] = [];

  for (let i = 0; i < weeks; i++) {
    switch (pattern) {
      case 'constant':
        demand.push(demandConfig.baseDemand);
        break;
      case 'random':
        demand.push(Math.floor(Math.random() * (demandConfig.randomMax - demandConfig.randomMin + 1)) + demandConfig.randomMin);
        break;
      case 'spike':
        // Classic beer game: constant then step up permanently at spike week
        demand.push(i < demandConfig.spikeWeek ? demandConfig.baseDemand : demandConfig.spikeAmount);
        break;
      case 'seasonal':
        // Sinusoidal pattern around base demand
        const amplitude = demandConfig.baseDemand * 0.5;
        const period = 12; // 12-week cycle
        demand.push(Math.max(1, Math.round(demandConfig.baseDemand + amplitude * Math.sin((2 * Math.PI * i) / period))));
        break;
    }
  }

  return demand;
}

/**
 * Initialize a single stage's state with configurable delays
 */
function initializeStage(role: Role, config: GameConfig): StageState {
  const baseDemand = config.demandConfig.baseDemand;
  return {
    role,
    inventory: config.initialInventory,
    backlog: 0,
    incomingOrders: baseDemand,
    outgoingShipments: 0,
    incomingShipments: 0,
    lastOrderPlaced: baseDemand,
    totalInventoryCost: 0,
    totalBacklogCost: 0,
    // Initialize pipelines based on configured delays
    orderPipeline: Array(config.orderDelay).fill(baseDemand),
    shipmentPipeline: Array(config.shipmentDelay).fill(baseDemand),
  };
}

/**
 * Initialize the complete game state
 */
export function initializeGame(config: Partial<GameConfig> = {}): GameState {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  if (config.demandConfig) {
    finalConfig.demandConfig = { ...DEFAULT_DEMAND_CONFIG, ...config.demandConfig };
  }

  const stages: Record<Role, StageState> = {
    retailer: initializeStage('retailer', finalConfig),
    wholesaler: initializeStage('wholesaler', finalConfig),
    distributor: initializeStage('distributor', finalConfig),
    factory: initializeStage('factory', finalConfig),
  };

  const history: Record<Role, WeeklyRecord[]> = {
    retailer: [],
    wholesaler: [],
    distributor: [],
    factory: [],
  };

  return {
    currentWeek: 1,
    totalWeeks: finalConfig.totalWeeks,
    playerRole: finalConfig.playerRole,
    demandPattern: finalConfig.demandPattern,
    demandConfig: finalConfig.demandConfig,
    stages,
    history,
    customerDemand: generateDemand(finalConfig.demandPattern, finalConfig.totalWeeks, finalConfig.demandConfig),
    isGameOver: false,
    isStarted: true,
    config: finalConfig,
  };
}

/**
 * Simple AI ordering policy: order to maintain target inventory
 */
export function calculateAIOrder(stage: StageState): number {
  const targetInventory = 12;
  const order = targetInventory - stage.inventory + stage.backlog + stage.incomingOrders;
  return Math.max(0, Math.round(order));
}

/**
 * Process a non-retailer stage's week.
 * Orders arrive via the order pipeline (delayed).
 */
function processStageWeek(
  stage: StageState,
  orderFromDownstream: number,
  config: GameConfig
): { shipmentToDownstream: number } {
  // 1. Receive incoming shipments (from pipeline)
  const receivedShipments = stage.shipmentPipeline.shift() || 0;
  stage.inventory += receivedShipments;
  stage.incomingShipments = receivedShipments;

  // 2. Receive incoming orders from pipeline (delayed orders)
  const receivedOrders = stage.orderPipeline.shift() || 0;
  stage.incomingOrders = receivedOrders;

  // 3. Add new order from downstream to pipeline (will arrive after delay)
  stage.orderPipeline.push(orderFromDownstream);

  // 4. Calculate total demand (received orders + existing backlog)
  const totalDemand = stage.incomingOrders + stage.backlog;

  // 5. Ship as much as possible
  const shipped = Math.min(stage.inventory, totalDemand);
  stage.inventory -= shipped;
  stage.outgoingShipments = shipped;

  // 6. Update backlog
  stage.backlog = totalDemand - shipped;

  // 7. Calculate costs
  const inventoryCost = stage.inventory * config.inventoryCostPerUnit;
  const backlogCost = stage.backlog * config.backlogCostPerUnit;
  stage.totalInventoryCost += inventoryCost;
  stage.totalBacklogCost += backlogCost;

  return { shipmentToDownstream: shipped };
}

/**
 * Process the retailer's week.
 * Customer demand arrives immediately (no order delay).
 */
function processRetailerWeek(
  stage: StageState,
  customerDemand: number,
  config: GameConfig
): void {
  // 1. Receive incoming shipments from pipeline
  const receivedShipments = stage.shipmentPipeline.shift() || 0;
  stage.inventory += receivedShipments;
  stage.incomingShipments = receivedShipments;

  // 2. Customer demand arrives immediately
  stage.incomingOrders = customerDemand;

  // 3. Calculate total demand (customer demand + existing backlog)
  const totalDemand = customerDemand + stage.backlog;

  // 4. Ship as much as possible to customer
  const shipped = Math.min(stage.inventory, totalDemand);
  stage.inventory -= shipped;
  stage.outgoingShipments = shipped;

  // 5. Update backlog
  stage.backlog = totalDemand - shipped;

  // 6. Calculate costs
  const inventoryCost = stage.inventory * config.inventoryCostPerUnit;
  const backlogCost = stage.backlog * config.backlogCostPerUnit;
  stage.totalInventoryCost += inventoryCost;
  stage.totalBacklogCost += backlogCost;
}

/**
 * Process the factory (produces goods instead of receiving shipments from upstream)
 */
function processFactoryWeek(
  stage: StageState,
  orderFromDownstream: number,
  config: GameConfig
): { shipmentToDownstream: number } {
  // Factory receives its own production (from shipment pipeline = production delay)
  const producedGoods = stage.shipmentPipeline.shift() || 0;
  stage.inventory += producedGoods;
  stage.incomingShipments = producedGoods;

  // Receive orders from distributor via pipeline
  const receivedOrders = stage.orderPipeline.shift() || 0;
  stage.incomingOrders = receivedOrders;

  // Add new order to pipeline
  stage.orderPipeline.push(orderFromDownstream);

  // Calculate total demand
  const totalDemand = stage.incomingOrders + stage.backlog;

  // Ship as much as possible
  const shipped = Math.min(stage.inventory, totalDemand);
  stage.inventory -= shipped;
  stage.outgoingShipments = shipped;

  // Update backlog
  stage.backlog = totalDemand - shipped;

  // Calculate costs
  const inventoryCost = stage.inventory * config.inventoryCostPerUnit;
  const backlogCost = stage.backlog * config.backlogCostPerUnit;
  stage.totalInventoryCost += inventoryCost;
  stage.totalBacklogCost += backlogCost;

  // Factory produces based on last order placed (unlimited raw materials)
  stage.shipmentPipeline.push(stage.lastOrderPlaced);

  return { shipmentToDownstream: shipped };
}

/**
 * Record the week's data for a stage
 */
function recordWeek(stage: StageState, week: number, config: GameConfig): WeeklyRecord {
  return {
    week,
    inventory: stage.inventory,
    backlog: stage.backlog,
    incomingOrders: stage.incomingOrders,
    orderPlaced: stage.lastOrderPlaced,
    incomingShipments: stage.incomingShipments,
    outgoingShipments: stage.outgoingShipments,
    cost: stage.inventory * config.inventoryCostPerUnit + stage.backlog * config.backlogCostPerUnit,
  };
}

/**
 * Advance the game by one week
 */
export function advanceWeek(
  gameState: GameState,
  playerOrder: number
): GameState {
  if (gameState.isGameOver) return gameState;

  const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
  const { currentWeek, stages } = newState;
  const config = newState.config;

  // Get customer demand for this week
  const customerDemand = newState.customerDemand[currentWeek - 1] || config.demandConfig.baseDemand;

  // 1. Set player's order
  stages[newState.playerRole].lastOrderPlaced = playerOrder;

  // 2. Calculate AI orders for non-player roles
  SUPPLY_CHAIN_ORDER.forEach((role) => {
    if (role !== newState.playerRole) {
      stages[role].lastOrderPlaced = calculateAIOrder(stages[role]);
    }
  });

  // 3. Process stages from upstream to downstream

  // Factory produces and ships to distributor
  const factoryResult = processFactoryWeek(stages.factory, stages.distributor.lastOrderPlaced, config);
  stages.distributor.shipmentPipeline.push(factoryResult.shipmentToDownstream);

  // Distributor ships to wholesaler
  const distributorResult = processStageWeek(stages.distributor, stages.wholesaler.lastOrderPlaced, config);
  stages.wholesaler.shipmentPipeline.push(distributorResult.shipmentToDownstream);

  // Wholesaler ships to retailer
  const wholesalerResult = processStageWeek(stages.wholesaler, stages.retailer.lastOrderPlaced, config);
  stages.retailer.shipmentPipeline.push(wholesalerResult.shipmentToDownstream);

  // Retailer serves customer demand (immediate, no order delay)
  processRetailerWeek(stages.retailer, customerDemand, config);

  // 4. Record history for all stages
  SUPPLY_CHAIN_ORDER.forEach((role) => {
    newState.history[role].push(recordWeek(stages[role], currentWeek, config));
  });

  // 5. Advance week
  newState.currentWeek++;

  // 6. Check game over
  if (newState.currentWeek > newState.totalWeeks) {
    newState.isGameOver = true;
  }

  return newState;
}

/**
 * Advance the game by one week — MULTIPLAYER version
 * Accepts orders from multiple human players; AI fills unoccupied roles.
 */
export function advanceWeekMultiplayer(
  gameState: GameState,
  humanOrders: Partial<Record<Role, number>>
): GameState {
  if (gameState.isGameOver) return gameState;

  const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
  const { currentWeek, stages } = newState;
  const config = newState.config;

  // Get customer demand for this week
  const customerDemand = newState.customerDemand[currentWeek - 1] || config.demandConfig.baseDemand;

  // Set orders for all roles: human orders where provided, AI for the rest
  SUPPLY_CHAIN_ORDER.forEach((role) => {
    if (humanOrders[role] !== undefined) {
      stages[role].lastOrderPlaced = Math.max(0, humanOrders[role]!);
    } else {
      stages[role].lastOrderPlaced = calculateAIOrder(stages[role]);
    }
  });

  // Process stages from upstream to downstream
  const factoryResult = processFactoryWeek(stages.factory, stages.distributor.lastOrderPlaced, config);
  stages.distributor.shipmentPipeline.push(factoryResult.shipmentToDownstream);

  const distributorResult = processStageWeek(stages.distributor, stages.wholesaler.lastOrderPlaced, config);
  stages.wholesaler.shipmentPipeline.push(distributorResult.shipmentToDownstream);

  const wholesalerResult = processStageWeek(stages.wholesaler, stages.retailer.lastOrderPlaced, config);
  stages.retailer.shipmentPipeline.push(wholesalerResult.shipmentToDownstream);

  processRetailerWeek(stages.retailer, customerDemand, config);

  // Record history
  SUPPLY_CHAIN_ORDER.forEach((role) => {
    newState.history[role].push(recordWeek(stages[role], currentWeek, config));
  });

  newState.currentWeek++;

  if (newState.currentWeek > newState.totalWeeks) {
    newState.isGameOver = true;
  }

  return newState;
}

/**
 * Run a full automated simulation (all AI) for instructor dashboard
 */
export function runAutomatedSimulation(config: Partial<GameConfig> = {}): GameState {
  let state = initializeGame(config);

  while (!state.isGameOver) {
    // All roles use AI ordering
    const playerStage = state.stages[state.playerRole];
    const aiOrder = calculateAIOrder(playerStage);
    state = advanceWeek(state, aiOrder);
  }

  return state;
}

/**
 * Calculate total cost for a stage
 */
export function calculateTotalCost(stage: StageState): number {
  return stage.totalInventoryCost + stage.totalBacklogCost;
}

/**
 * Calculate total system cost
 */
export function calculateSystemCost(stages: Record<Role, StageState>): number {
  return SUPPLY_CHAIN_ORDER.reduce((total, role) => total + calculateTotalCost(stages[role]), 0);
}

/**
 * Calculate order variance for a role's history
 */
export function calculateOrderVariance(history: WeeklyRecord[]): number {
  if (history.length === 0) return 0;
  const orders = history.map(h => h.orderPlaced);
  const mean = orders.reduce((a, b) => a + b, 0) / orders.length;
  const variance = orders.reduce((sum, o) => sum + Math.pow(o - mean, 2), 0) / orders.length;
  return variance;
}

/**
 * Calculate variance amplification ratio (bullwhip measure)
 */
export function calculateBullwhipRatio(history: Record<Role, WeeklyRecord[]>): Record<Role, number> {
  const demandVariance = calculateOrderVariance(history.retailer.map(h => ({ ...h, orderPlaced: h.incomingOrders })));
  const ratios: Record<Role, number> = {
    retailer: 1,
    wholesaler: 1,
    distributor: 1,
    factory: 1,
  };

  if (demandVariance > 0) {
    SUPPLY_CHAIN_ORDER.forEach(role => {
      ratios[role] = calculateOrderVariance(history[role]) / demandVariance;
    });
  }

  return ratios;
}
