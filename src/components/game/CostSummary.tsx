import { GameState, Role, ROLE_LABELS, SUPPLY_CHAIN_ORDER } from '@/types/game';
import { calculateTotalCost, calculateSystemCost } from '@/lib/gameLogic';
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CostSummaryProps {
  gameState: GameState;
}

export function CostSummary({ gameState }: CostSummaryProps) {
  const { stages, playerRole } = gameState;
  const systemCost = calculateSystemCost(stages);
  const playerCost = calculateTotalCost(stages[playerRole]);

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cost Summary</h2>
        <DollarSign className="h-5 w-5 text-primary" />
      </div>

      {/* Total System Cost */}
      <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground mb-1">Total System Cost</p>
        <p className="text-3xl font-bold gradient-text">${systemCost.toFixed(2)}</p>
      </div>

      {/* Individual Stage Costs */}
      <div className="space-y-2">
        {SUPPLY_CHAIN_ORDER.map((role) => {
          const stage = stages[role];
          const totalCost = calculateTotalCost(stage);
          const isPlayer = role === playerRole;

          return (
            <div
              key={role}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                isPlayer ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', isPlayer ? 'text-primary' : 'text-foreground')}>
                  {ROLE_LABELS[role]}
                </span>
                {isPlayer && (
                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                    You
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className={cn('font-semibold', isPlayer ? 'text-primary' : 'text-foreground')}>
                  ${totalCost.toFixed(2)}
                </p>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span>Inv: ${stage.totalInventoryCost.toFixed(2)}</span>
                  <span>Back: ${stage.totalBacklogCost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cost Formula Reminder */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <p className="font-medium mb-1">Cost Formula:</p>
        <p>
          Inventory: <span className="text-success">$0.50</span>/unit/week · Backlog:{' '}
          <span className="text-destructive">$1.00</span>/unit/week
        </p>
      </div>
    </div>
  );
}
