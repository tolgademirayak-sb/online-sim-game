import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Role, ROLE_LABELS, GameState, TimerConfig } from '@/types/game';
import { peerService, RoomState } from '@/lib/peerService';
import { Button } from '@/components/ui/button';
import { GameSummary } from '@/components/game/GameSummary';
import { GameCharts } from '@/components/game/GameCharts';
import { CostSummary } from '@/components/game/CostSummary';
import { cn } from '@/lib/utils';
import { Copy, Check, Crown, Loader2, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function MultiplayerRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { playerName, isHost } = (location.state as { playerName: string; isHost: boolean }) || {};

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myRole, setMyRole] = useState<Role | undefined>();
  const [isReady, setIsReady] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hasSubmittedOrder, setHasSubmittedOrder] = useState(false);
  const [waitingForOthers, setWaitingForOthers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [costReviews, setCostReviews] = useState<Record<number, {
    week: number;
    enteredCost: number;
    trueCost: number;
    isCorrect: boolean;
  }>>({});

  const getIsCurrentPlayer = (player: RoomState['players'][number]) => (
    isHost ? player.isHost : !player.isHost && player.name === playerName
  );

  const getDisplayName = (player: RoomState['players'][number], index: number) => {
    if (!roomState?.anonymousMode || isHost) {
      return player.name;
    }

    if (getIsCurrentPlayer(player)) {
      return 'You';
    }

    return `Player ${index + 1}`;
  };

  useEffect(() => {
    if (!roomId || !playerName) {
      navigate('/multiplayer');
      return;
    }

    // Subscribe to messages
    const unsubs = [
      peerService.on('ROOM_STATE', (msg) => {
        setRoomState(msg.payload);
      }),
      peerService.on('GAME_STARTED', (msg) => {
        setGameState(msg.payload.gameState);
        toast.success('Game started!');
      }),
      peerService.on('GAME_STATE', (msg) => {
        setGameState(msg.payload);
        setHasSubmittedOrder(false);
        setWaitingForOthers(false);
      }),
      peerService.on('GAME_OVER', (msg) => {
        setGameState(msg.payload.gameState);
      }),
      peerService.on('PLAYER_DISCONNECTED', (msg) => {
        toast.warning(
          roomState?.anonymousMode && !isHost
            ? 'A player disconnected'
            : `${msg.payload.playerName} disconnected`
        );
      }),
      peerService.on('HOST_DISCONNECTED', () => {
        setHostDisconnected(true);
        toast.error('Host disconnected — game over');
      }),
      peerService.on('ERROR', (msg) => {
        toast.error(msg.payload.message);
      }),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [roomId, playerName, navigate]);

  // Get initial room state on mount (for host, whose ROOM_STATE fires before handlers register)
  useEffect(() => {
    const initialState = peerService.getCurrentRoomState();
    if (initialState) {
      setRoomState(initialState);
    }
  }, []);

  useEffect(() => {
    if (!roomState) return;

    const currentPlayer = roomState.players.find((player) => getIsCurrentPlayer(player));

    setMyRole(currentPlayer?.role);
    setIsReady(!!currentPlayer?.isReady);
  }, [roomState, isHost, playerName]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only cleanup if navigating away (not on re-render)
    };
  }, []);

  const handleReady = () => {
    if (!roomId) return;
    peerService.setReady();
    setIsReady(true);
  };

  const handleStartGame = () => {
    if (!roomId) return;
    peerService.startGame();
  };

  const handleSubmitOrder = (quantity: number) => {
    if (!roomId || !myRole || !gameState) return;
    peerService.submitOrder(myRole, gameState.currentWeek, quantity);
    setHasSubmittedOrder(true);
    setWaitingForOthers(true);
  };

  const handleDraftOrderChange = (quantity: number) => {
    if (!myRole || !gameState) return;
    peerService.updateDraftOrder(myRole, quantity);
  };

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).catch(() => {
        // Fallback for non-HTTPS
        toast.info(`Room ID: ${roomId}`);
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    peerService.cleanup();
    navigate('/');
  };

  const handleHostRoleChange = (playerId: string, role: Role) => {
    const changed = peerService.assignRole(playerId, role);
    if (!changed) {
      toast.error('Could not change role');
    }
  };

  const playerHistory = gameState && myRole ? gameState.history[myRole] : [];
  const latestPlayerRecord = playerHistory[playerHistory.length - 1];
  const pendingCostReview = latestPlayerRecord && latestPlayerRecord.week <= 10 && !costReviews[latestPlayerRecord.week]
    ? latestPlayerRecord
    : null;
  const latestCostReview = latestPlayerRecord ? costReviews[latestPlayerRecord.week] || null : null;

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

  const handleAnonymousModeToggle = (enabled: boolean) => {
    const changed = peerService.setAnonymousMode(enabled);
    if (!changed) {
      toast.error('Anonymous mode can only be changed before the game starts');
    }
  };

  const handleTimerConfigChange = (field: keyof TimerConfig, value: number) => {
    const changed = peerService.updateTimerConfig({ [field]: value });
    if (!changed) {
      toast.error('Timer settings can only be changed before the game starts');
    }
  };

  const timerState = roomState?.timerState;
  const remainingSeconds = timerState?.isActive
    ? Math.max(0, Math.ceil((timerState.endsAtMs - nowMs) / 1000))
    : null;
  const minutes = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : 0;
  const seconds = remainingSeconds !== null ? remainingSeconds % 60 : 0;
  const timerLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timerConfig = roomState?.gameConfig?.timerConfig;

  // Host disconnected screen
  if (hostDisconnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center">
            <div className="rounded-full bg-destructive/20 p-6">
              <AlertTriangle className="h-16 w-16 text-destructive" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Host Disconnected</h1>
          <p className="text-muted-foreground">
            The host has left the game. The session has ended.
          </p>
          <Button onClick={handleLeave} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 px-8">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // If game is over
  if (gameState?.isGameOver) {
    return (
      <GameSummary
        gameState={gameState}
        onRestart={handleLeave}
        playerRoleOverride={myRole}
        privateView={true}
      />
    );
  }

  // If game is in progress
  if (gameState && myRole) {
    const playerStage = gameState.stages[myRole];
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Multiplayer Header */}
          <div className="glass-card rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/20 p-2">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Room <span className="font-mono text-primary">{roomId}</span>
                  {isHost && <span className="text-xs text-muted-foreground ml-2">(Host)</span>}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Week {gameState.currentWeek} of {gameState.totalWeeks} · You are {ROLE_LABELS[myRole]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {timerState?.isActive && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Round Timer</p>
                  <p className="text-lg font-bold text-primary">{timerLabel}</p>
                </div>
              )}

              {waitingForOthers && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Waiting for other players...
                </div>
              )}
            </div>
          </div>

          {timerState?.isActive && (
            <div className="glass-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Round {timerState.round} countdown</p>
                <p className="text-xs text-muted-foreground">
                  If time runs out, your latest valid draft order will be submitted automatically.
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary tabular-nums">{timerLabel}</p>
                <p className="text-xs text-muted-foreground">{timerState.durationSeconds}s this round</p>
              </div>
            </div>
          )}

          {/* Reuse single-player components */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Place Your Order</h2>
                <MultiplayerOrderInput
                  role={myRole}
                  round={gameState.currentWeek}
                  stage={playerStage}
                  onDraftChange={handleDraftOrderChange}
                  onSubmitOrder={handleSubmitOrder}
                  disabled={hasSubmittedOrder || !!pendingCostReview}
                />
                {hasSubmittedOrder && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3">
                    <CheckCircle2 className="h-4 w-4" />
                    Order submitted — waiting for others
                  </div>
                )}
              </div>
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Your Operations</h2>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Incoming Shipments</p>
                    <p className="mt-1 text-2xl font-bold text-success">{playerStage.incomingShipments}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Outgoing Shipments</p>
                    <p className="mt-1 text-2xl font-bold text-accent">{playerStage.outgoingShipments}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Last Order Placed</p>
                    <p className="mt-1 text-2xl font-bold text-primary">{playerStage.lastOrderPlaced}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Current Role</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{ROLE_LABELS[myRole]}</p>
                  </div>
                </div>
              </div>
              <CostSummary
                gameState={gameState}
                viewerRoleOverride={myRole}
                privateView={true}
                pendingCostReview={pendingCostReview}
                latestCostReview={latestCostReview}
                onSubmitCostReview={handleSubmitCostReview}
              />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Private History</h3>
                <GameCharts history={gameState.history} playerRole={myRole} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LOBBY VIEW
  const allReady = roomState?.players?.every(p => p.isReady && p.role) ?? false;
  const playerCount = roomState?.players?.length ?? 0;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6 animate-fade-in">
        {/* Room Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">Game Lobby</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Room ID:</span>
            <code className="font-mono text-2xl font-bold text-primary tracking-widest">{roomId}</code>
            <Button variant="ghost" size="sm" onClick={handleCopyRoomId} className="h-8 w-8 p-0">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Share the Room ID and password with your teammates</p>
        </div>

        {/* Players */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Players ({playerCount}/4)</h2>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(roomState?.players || []).map((player, index) => (
              <div key={player.id} className={cn(
                'rounded-lg p-3 border',
                player.isReady ? 'border-success/50 bg-success/5' : 'border-border bg-muted/30'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {(!roomState?.anonymousMode || isHost) && player.isHost && <Crown className="h-3 w-3 text-primary" />}
                  <span className="text-sm font-medium text-foreground">{getDisplayName(player, index)}</span>
                  {player.isReady && <CheckCircle2 className="h-3 w-3 text-success ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {player.role ? ROLE_LABELS[player.role] : 'AI controlled'}
                </p>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 4 - playerCount) }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-lg p-3 border border-dashed border-border/50 bg-muted/10 flex items-center justify-center">
                <span className="text-xs text-muted-foreground/50">Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Role */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Your Assignment</h2>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Assigned role</p>
            <p className="mt-1 text-xl font-bold text-primary">
              {myRole ? ROLE_LABELS[myRole] : 'Waiting for host assignment'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Roles are assigned automatically. Any missing roles are handled by AI.
            </p>
          </div>
        </div>

        {isHost && !roomState?.isGameStarted && (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="rounded-lg bg-muted/30 p-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-foreground">Anonymous Players</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Hide real player identities from regular players for this session.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <span>{roomState?.anonymousMode ? 'ON' : 'OFF'}</span>
                <input
                  type="checkbox"
                  checked={!!roomState?.anonymousMode}
                  onChange={(e) => handleAnonymousModeToggle(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>

            <div>
              <h2 className="font-semibold text-foreground">Admin Role Overrides</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Automatic assignment is the default. Use these controls only if you want to manually adjust seats.
              </p>
            </div>

            <div className="space-y-3">
              {(roomState?.players || []).map((player, index) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {getDisplayName(player, index)} {player.isHost && '(Host)'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current: {player.role ? ROLE_LABELS[player.role] : 'Unassigned'}
                    </p>
                  </div>

                  <select
                    value={player.role || ''}
                    onChange={(e) => handleHostRoleChange(player.id, e.target.value as Role)}
                    className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground"
                  >
                    {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {timerConfig && (
              <div className="space-y-3 pt-2">
                <div>
                  <h2 className="font-semibold text-foreground">Round Timer Settings</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    The host controls the round clock. Settings lock when the game starts.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TimerNumberField
                    label="Early rounds"
                    value={timerConfig.earlyRounds}
                    min={0}
                    onChange={(value) => handleTimerConfigChange('earlyRounds', value)}
                  />
                  <TimerNumberField
                    label="Final rounds"
                    value={timerConfig.finalRounds}
                    min={0}
                    onChange={(value) => handleTimerConfigChange('finalRounds', value)}
                  />
                  <TimerNumberField
                    label="Early duration (s)"
                    value={timerConfig.earlyRoundDurationSec}
                    min={5}
                    onChange={(value) => handleTimerConfigChange('earlyRoundDurationSec', value)}
                  />
                  <TimerNumberField
                    label="Middle duration (s)"
                    value={timerConfig.middleRoundDurationSec}
                    min={5}
                    onChange={(value) => handleTimerConfigChange('middleRoundDurationSec', value)}
                  />
                  <TimerNumberField
                    label="Final duration (s)"
                    value={timerConfig.finalRoundDurationSec}
                    min={5}
                    onChange={(value) => handleTimerConfigChange('finalRoundDurationSec', value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!isReady ? (
            <Button
              onClick={handleReady}
              disabled={!myRole}
              className="flex-1 gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12"
            >
              <CheckCircle2 className="h-5 w-5" />
              Ready
            </Button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 text-success text-sm font-medium glass-card rounded-xl h-12">
              <CheckCircle2 className="h-4 w-4" />
              You're ready!
            </div>
          )}

          {isHost && (
            <Button
              onClick={handleStartGame}
              disabled={!allReady || playerCount < 2}
              className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12"
            >
              Start Game
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple multiplayer order input
function MultiplayerOrderInput({ role, round, stage, onDraftChange, onSubmitOrder, disabled }: {
  role: Role;
  round: number;
  stage: { inventory: number; backlog: number; incomingOrders: number; lastOrderPlaced: number };
  onDraftChange: (q: number) => void;
  onSubmitOrder: (q: number) => void;
  disabled: boolean;
}) {
  const [qty, setQty] = useState(4);

  useEffect(() => {
    const nextQty = Math.max(0, stage.lastOrderPlaced ?? 4);
    setQty(nextQty);
    onDraftChange(nextQty);
  }, [round, stage.lastOrderPlaced, onDraftChange]);

  const incomingLabel = role === 'retailer' ? 'Customer Demand' : 'Orders In';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-muted-foreground">Inventory</p>
          <p className="text-lg font-bold text-success">{stage.inventory}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-muted-foreground">Backlog</p>
          <p className="text-lg font-bold text-destructive">{stage.backlog}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-muted-foreground">{incomingLabel}</p>
          <p className="text-lg font-bold text-accent">{stage.incomingOrders}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={999}
          value={qty}
          onChange={e => {
            const nextQty = Math.max(0, parseInt(e.target.value) || 0);
            setQty(nextQty);
            onDraftChange(nextQty);
          }}
          disabled={disabled}
          className="flex-1 h-12 text-center text-xl font-bold rounded-lg bg-secondary border border-border text-foreground"
        />
        <Button onClick={() => onSubmitOrder(Math.max(0, qty))} disabled={disabled} className="h-12 px-6 bg-primary text-primary-foreground font-semibold">
          Submit
        </Button>
      </div>
    </div>
  );
}

function TimerNumberField({ label, value, min, onChange }: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2 rounded-lg bg-muted/30 p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || min))}
        className="h-10 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground"
      />
    </label>
  );
}
