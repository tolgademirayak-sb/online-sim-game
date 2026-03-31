import { useState } from 'react';
import { GameState, Role, ROLE_LABELS, SUPPLY_CHAIN_ORDER, WeeklyRecord } from '@/types/game';
import { calculateTotalCost, calculateSystemCost } from '@/lib/gameLogic';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CostReviewResult {
  week: number;
  enteredCost: number;
  trueCost: number;
  isCorrect: boolean;
}

interface CostSummaryProps {
  gameState: GameState;
  viewerRoleOverride?: Role;
  privateView?: boolean;
  pendingCostReview?: WeeklyRecord | null;
  latestCostReview?: CostReviewResult | null;
  onSubmitCostReview?: (enteredCost: number) => void;
}

export function CostSummary({
  gameState,
  viewerRoleOverride,
  privateView = false,
  pendingCostReview = null,
  latestCostReview = null,
  onSubmitCostReview,
}: CostSummaryProps) {
  const { stages } = gameState;
  const playerRole = viewerRoleOverride || gameState.playerRole;
  const systemCost = calculateSystemCost(stages);
  const playerCost = calculateTotalCost(stages[playerRole]);
  const playerStage = stages[playerRole];
  const [enteredCost, setEnteredCost] = useState('');
  const isCostLocked = !!pendingCostReview;

  const handleSubmitCostReview = () => {
    if (!onSubmitCostReview) return;
    onSubmitCostReview(Math.max(0, Number(enteredCost) || 0));
    setEnteredCost('');
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Cost Summary</h2>
        <DollarSign className="h-5 w-5 text-primary" />
      </div>

      {/* Main Cost */}
      <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground mb-1">
          {isCostLocked
            ? `Week ${pendingCostReview?.week} Cost Check`
            : privateView ? 'Your Total Cost' : 'Total System Cost'}
        </p>
        <p className="text-3xl font-bold gradient-text">
          {isCostLocked ? 'Enter Your Cost' : `$${privateView ? playerCost.toFixed(2) : systemCost.toFixed(2)}`}
        </p>
      </div>

      {isCostLocked ? (
        <div className="space-y-4 rounded-lg bg-primary/10 border border-primary/30 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">What was your cost for Week {pendingCostReview?.week}?</p>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your estimate first. We will validate it against the true internally calculated cost.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="cost-review" className="text-xs text-muted-foreground">Your Cost Estimate</Label>
              <Input
                id="cost-review"
                type="number"
                min={0}
                step="0.01"
                value={enteredCost}
                onChange={(event) => setEnteredCost(event.target.value)}
                className="mt-1 bg-secondary border-border"
              />
            </div>
            <Button onClick={handleSubmitCostReview} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Submit Cost
            </Button>
          </div>
        </div>
      ) : privateView ? (
        <div className="rounded-lg bg-primary/10 border border-primary/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">{ROLE_LABELS[playerRole]}</span>
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                You
              </span>
            </div>
            <p className="font-semibold text-primary">${playerCost.toFixed(2)}</p>
          </div>
          <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
            <span>Inventory Cost: ${playerStage.totalInventoryCost.toFixed(2)}</span>
            <span>Backlog Cost: ${playerStage.totalBacklogCost.toFixed(2)}</span>
          </div>
        </div>
      ) : (
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
      )}

      {!isCostLocked && latestCostReview && latestCostReview.week <= 10 && (
        <div className={cn(
          'rounded-lg p-4 text-sm border',
          latestCostReview.isCorrect
            ? 'bg-success/10 border-success/30 text-success'
            : 'bg-destructive/10 border-destructive/30 text-destructive'
        )}>
          <p className="font-medium">
            Week {latestCostReview.week} {latestCostReview.isCorrect ? 'cost entry was correct.' : 'cost entry was incorrect.'}
          </p>
          <p className="mt-1 text-muted-foreground">
            You entered ${latestCostReview.enteredCost.toFixed(2)}. True cost: ${latestCostReview.trueCost.toFixed(2)}.
          </p>
        </div>
      )}

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
