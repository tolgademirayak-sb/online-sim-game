import { useState } from 'react';
import { GameState, Role, DemandPattern, DemandConfig } from '@/types/game';
import { initializeGame } from '@/lib/gameLogic';
import { GameSetup } from '@/components/game/GameSetup';
import { GameDashboard } from '@/components/game/GameDashboard';

const Index = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleStartGame = (config: {
    role: Role;
    weeks: number;
    demandPattern: DemandPattern;
    demandConfig: DemandConfig;
    orderDelay: number;
    shipmentDelay: number;
  }) => {
    const newGame = initializeGame({
      playerRole: config.role,
      totalWeeks: config.weeks,
      demandPattern: config.demandPattern,
      demandConfig: config.demandConfig,
      orderDelay: config.orderDelay,
      shipmentDelay: config.shipmentDelay,
    });
    setGameState(newGame);
  };

  const handleRestart = () => {
    setGameState(null);
  };

  if (!gameState) {
    return <GameSetup onStartGame={handleStartGame} />;
  }

  return <GameDashboard initialGameState={gameState} onRestart={handleRestart} />;
};

export default Index;
