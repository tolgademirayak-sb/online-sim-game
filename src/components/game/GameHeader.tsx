import { GameState, ROLE_LABELS } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Beer, RotateCcw, SkipForward } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface GameHeaderProps {
  gameState: GameState;
  onNextWeek: () => void;
  onRestart: () => void;
  canAdvance: boolean;
}

export function GameHeader({ gameState, onNextWeek, onRestart, canAdvance }: GameHeaderProps) {
  const { currentWeek, totalWeeks, playerRole, isGameOver } = gameState;
  const progress = ((currentWeek - 1) / totalWeeks) * 100;

  return (
    <header className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/20 p-2">
            <Beer className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">The Beer Game</h1>
            <p className="text-xs text-muted-foreground">
              Playing as <span className="text-primary font-medium">{ROLE_LABELS[playerRole]}</span>
            </p>
          </div>
        </div>

        {/* Week Progress */}
        <div className="flex-1 max-w-md mx-8 hidden md:block">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-foreground font-medium">
              Week {currentWeek} of {totalWeeks}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!isGameOver && (
            <Button
              onClick={onNextWeek}
              disabled={!canAdvance}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <SkipForward className="h-4 w-4" />
              <span className="hidden sm:inline">Next Week</span>
            </Button>
          )}
          <Button
            onClick={onRestart}
            variant="outline"
            className="gap-2 border-border hover:bg-secondary"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Restart</span>
          </Button>
        </div>
      </div>

      {/* Mobile Week Display */}
      <div className="mt-3 md:hidden">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">Week {currentWeek} of {totalWeeks}</span>
          <span className="text-primary font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </header>
  );
}
