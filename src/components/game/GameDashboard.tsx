import { useState } from 'react';
import { GameState } from '@/types/game';
import { advanceWeek } from '@/lib/gameLogic';
import { GameHeader } from './GameHeader';
import { SupplyChainFlow } from './SupplyChainFlow';
import { OrderInput } from './OrderInput';
import { CostSummary } from './CostSummary';
import { GameCharts } from './GameCharts';
import { GameSummary } from './GameSummary';

interface GameDashboardProps {
  initialGameState: GameState;
  onRestart: () => void;
}

interface CostReviewResult {
  week: number;
  enteredCost: number;
  trueCost: number;
  isCorrect: boolean;
}

export function GameDashboard({ initialGameState, onRestart }: GameDashboardProps) {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [hasOrdered, setHasOrdered] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<number | null>(null);
  const [costReviews, setCostReviews] = useState<Record<number, CostReviewResult>>({});

  const playerHistory = gameState.history[gameState.playerRole];
  const latestPlayerRecord = playerHistory[playerHistory.length - 1];
  const pendingCostReview = latestPlayerRecord && latestPlayerRecord.week <= 10 && !costReviews[latestPlayerRecord.week]
    ? latestPlayerRecord
    : null;
  const latestCostReview = latestPlayerRecord ? costReviews[latestPlayerRecord.week] || null : null;

  const handleSubmitOrder = (quantity: number) => {
    setPendingOrder(quantity);
    setHasOrdered(true);
  };

  const handleNextWeek = () => {
    if (pendingOrder !== null) {
      const newState = advanceWeek(gameState, pendingOrder);
      setGameState(newState);
      setPendingOrder(null);
      setHasOrdered(false);
    }
  };

  const handleSubmitCostReview = (enteredCost: number) => {
    if (!pendingCostReview) return;

    const trueCost = Number(pendingCostReview.cost.toFixed(2));
    const normalizedEntry = Number(enteredCost.toFixed(2));

    setCostReviews((prev) => ({
      ...prev,
      [pendingCostReview.week]: {
        week: pendingCostReview.week,
        enteredCost: normalizedEntry,
        trueCost,
        isCorrect: Math.abs(normalizedEntry - trueCost) < 0.01,
      },
    }));
  };

  // Show summary screen when game is over
  if (gameState.isGameOver) {
    return <GameSummary gameState={gameState} onRestart={onRestart} />;
  }

  const playerStage = gameState.stages[gameState.playerRole];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <GameHeader
          gameState={gameState}
          onNextWeek={handleNextWeek}
          onRestart={onRestart}
          canAdvance={hasOrdered}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <OrderInput
              stage={playerStage}
              onSubmitOrder={handleSubmitOrder}
              disabled={hasOrdered || !!pendingCostReview}
              shipmentDelay={gameState.config.shipmentDelay}
              orderDelay={gameState.config.orderDelay}
            />
            <CostSummary
              gameState={gameState}
              pendingCostReview={pendingCostReview}
              latestCostReview={latestCostReview}
              onSubmitCostReview={handleSubmitCostReview}
            />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <SupplyChainFlow gameState={gameState} />
            <GameCharts history={gameState.history} playerRole={gameState.playerRole} />
          </div>
        </div>

        {hasOrdered && pendingOrder !== null && (
          <div className="fixed bottom-4 right-4 glass-card rounded-xl p-4 shadow-xl animate-slide-in-right">
            <p className="text-sm text-foreground">
              Order placed: <span className="text-primary font-bold">{pendingOrder} units</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Next Week" to continue
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
