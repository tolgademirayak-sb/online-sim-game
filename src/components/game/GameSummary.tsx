import { GameState, ROLE_LABELS, Role, SUPPLY_CHAIN_ORDER } from '@/types/game';
import { calculateTotalCost, calculateSystemCost } from '@/lib/gameLogic';
import { GameCharts } from './GameCharts';
import { Button } from '@/components/ui/button';
import { Trophy, Award, TrendingDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameSummaryProps {
  gameState: GameState;
  onRestart: () => void;
  playerRoleOverride?: Role;
  privateView?: boolean;
}

export function GameSummary({ gameState, onRestart, playerRoleOverride, privateView = false }: GameSummaryProps) {
  const { stages, totalWeeks, history } = gameState;
  const playerRole = playerRoleOverride || gameState.playerRole;
  const systemCost = calculateSystemCost(stages);
  const playerStage = stages[playerRole];
  const playerCost = calculateTotalCost(playerStage);

  const rankings = SUPPLY_CHAIN_ORDER.map((role) => ({
    role,
    stage: stages[role],
    cost: calculateTotalCost(stages[role]),
  })).filter((rank) => !!rank.stage).sort((a, b) => a.cost - b.cost);

  const playerRank = rankings.findIndex((rank) => rank.role === playerRole) + 1;
  const playerHistory = history[playerRole] || [];
  const maxInventory = playerHistory.length > 0 ? Math.max(...playerHistory.map((entry) => entry.inventory)) : 0;
  const maxBacklog = playerHistory.length > 0 ? Math.max(...playerHistory.map((entry) => entry.backlog)) : 0;
  const avgOrder = playerHistory.length > 0
    ? playerHistory.reduce((sum, entry) => sum + entry.orderPlaced, 0) / playerHistory.length
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center">
            <div className="rounded-full bg-primary/20 p-6 animate-pulse-glow">
              <Trophy className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground">Simulation Complete!</h1>
          <p className="text-muted-foreground">
            {totalWeeks} weeks as {ROLE_LABELS[playerRole]}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Your Performance
            </h2>

            <div className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">Your Total Cost</p>
              <p className="text-5xl font-bold gradient-text">${playerCost.toFixed(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Rank</p>
                <p className={cn('text-2xl font-bold', playerRank === 1 ? 'text-primary' : 'text-foreground')}>
                  #{playerRank}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {privateView ? 'System Cost' : 'System Cost'}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {privateView ? '-' : `$${systemCost.toFixed(2)}`}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Inventory Held</span>
                <span className="text-foreground font-medium">{maxInventory} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Backlog</span>
                <span className="text-destructive font-medium">{maxBacklog} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. Order Size</span>
                <span className="text-foreground font-medium">{avgOrder.toFixed(1)} units</span>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-accent" />
              {privateView ? 'Your Placement' : 'Cost Leaderboard'}
            </h2>

            {privateView ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-primary/10 border border-primary/30 p-5">
                  <p className="text-sm text-muted-foreground">Final Rank</p>
                  <p className="mt-2 text-4xl font-bold text-primary">#{playerRank}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You finished as {ROLE_LABELS[playerRole]} with a total cost of ${playerCost.toFixed(2)}.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Other players&apos; private stock, backlog, and cost details are hidden in multiplayer mode.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankings.map((rank, index) => {
                  const isPlayer = rank.role === playerRole;
                  const stage = rank.stage;

                  return (
                    <div
                      key={rank.role}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-lg',
                        isPlayer ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                        index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-medium', isPlayer ? 'text-primary' : 'text-foreground')}>
                            {ROLE_LABELS[rank.role]}
                          </span>
                          {isPlayer && (
                            <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Inv: ${stage.totalInventoryCost.toFixed(2)} · Back: ${stage.totalBacklogCost.toFixed(2)}
                        </div>
                      </div>
                      <div className={cn('text-xl font-bold', isPlayer ? 'text-primary' : 'text-foreground')}>
                        ${rank.cost.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <GameCharts history={history} playerRole={playerRole} showAllRoles={!privateView} />

        <div className="flex justify-center gap-4">
          <Button
            onClick={onRestart}
            size="lg"
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-14 px-8"
          >
            <RotateCcw className="h-5 w-5" />
            Play Again
          </Button>
        </div>

        <div className="glass-card rounded-xl p-6 text-center max-w-2xl mx-auto">
          <h3 className="font-semibold text-foreground mb-2">The Bullwhip Effect</h3>
          <p className="text-sm text-muted-foreground">
            Notice how order variability increases as you move upstream in the supply chain?
            This is the <span className="text-primary font-medium">bullwhip effect</span>:
            small fluctuations in customer demand get amplified through the supply chain,
            causing larger swings in orders, inventory, and costs.
          </p>
        </div>
      </div>
    </div>
  );
}
