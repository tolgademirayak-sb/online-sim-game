import { GameState, SUPPLY_CHAIN_ORDER, ROLE_LABELS } from '@/types/game';
import { StageCard } from './StageCard';
import { ArrowRight, Users } from 'lucide-react';

interface SupplyChainFlowProps {
  gameState: GameState;
}

export function SupplyChainFlow({ gameState }: SupplyChainFlowProps) {
  const { stages, playerRole, customerDemand, currentWeek } = gameState;
  const currentDemand = customerDemand[Math.max(0, currentWeek - 2)] || 4;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Supply Chain Overview</h2>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-4">
        {/* Customer */}
        <div className="flex-shrink-0 glass-card rounded-xl p-4 min-w-[120px] text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="rounded-full bg-accent/20 p-2">
              <Users className="h-5 w-5 text-accent" />
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">Customer</p>
          <p className="text-xs text-muted-foreground mt-1">
            Demand: <span className="text-accent font-semibold">{currentDemand}</span>
          </p>
        </div>

        {/* Flow Arrow */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <ArrowRight className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-[10px] text-muted-foreground">orders</span>
        </div>

        {/* Supply Chain Stages */}
        {SUPPLY_CHAIN_ORDER.map((role, index) => (
          <div key={role} className="flex items-center gap-2">
            <div className="flex-shrink-0 min-w-[180px]">
              <StageCard
                stage={stages[role]}
                isPlayer={role === playerRole}
              />
            </div>
            
            {index < SUPPLY_CHAIN_ORDER.length - 1 && (
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">orders</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Flow Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-success" />
          <span>Healthy Inventory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-warning" />
          <span>Low Inventory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span>Has Backlog</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded ring-2 ring-primary" />
          <span>Your Role</span>
        </div>
      </div>
    </div>
  );
}
