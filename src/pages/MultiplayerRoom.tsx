import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Role, ROLE_LABELS, TimerConfig } from '@/types/game';
import * as api from '@/lib/apiService';
import { useRoomPolling, useGamePolling } from '@/hooks/useGamePolling';
import type { RoomStateResponse } from '@/lib/apiTypes';
import { Button } from '@/components/ui/button';
import { GameSummary } from '@/components/game/GameSummary';
import { GameCharts } from '@/components/game/GameCharts';
import { CostSummary } from '@/components/game/CostSummary';
import { cn } from '@/lib/utils';
import { Copy, Check, Crown, Loader2, Users, CheckCircle2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function MultiplayerRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<{ playerName: string; token: string } | null>(null);
  const sessionToken = sessionInfo?.token || localStorage.getItem('beer-game-session');

  // Polling hooks
  const { roomState } = useRoomPolling(roomId, 2000);
  const isGameActive = roomState?.status === 'playing';
  const { gamePoll } = useGamePolling(isGameActive ? roomId : undefined, 2000);

  const [hasSubmittedOrder, setHasSubmittedOrder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [gameOverState, setGameOverState] = useState<any>(null);
  const [costReviews, setCostReviews] = useState<Record<number, {
    week: number;
    enteredCost: number;
    trueCost: number;
    isCorrect: boolean;
  }>>({});

  // Find my player in the room
  const myPlayer = roomState?.players.find(p => p.sessionToken === sessionToken);
  const myRole = myPlayer?.role as Role | undefined;
  const amController = !!myPlayer?.isHost;

  // Detect round change — reset submission flag
  useEffect(() => {
    if (gamePoll) {
      setHasSubmittedOrder(false);
    }
  }, [gamePoll?.roundVersion]);

  // Timer tick
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    api.getCurrentSession().then((session) => {
      if (!session) {
        navigate('/multiplayer');
        return;
      }
      setSessionInfo(session);
    });
  }, [navigate]);

  // Navigate away if no session
  useEffect(() => {
    if (!roomId) {
      navigate('/multiplayer');
    }
  }, [roomId, navigate]);

  // Fetch full results when game is over
  useEffect(() => {
    if (gamePoll?.isGameOver && roomId && !gameOverState) {
      api.getGameResults(roomId).then(setGameOverState).catch(() => {});
    }
  }, [gamePoll?.isGameOver, roomId, gameOverState]);

  const getDisplayName = (player: RoomStateResponse['players'][number], index: number) => {
    if (!roomState?.anonymousMode || roomState.controllerMode === 'instructor' || amController) {
      return player.name;
    }
    if (player.sessionToken === sessionToken) return 'You';
    return `Player ${index + 1}`;
  };

  const handleReady = async () => {
    if (!roomId) return;
    try {
      await api.setReady(roomId);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartGame = async () => {
    if (!roomId) return;
    try {
      await api.startGame(roomId);
      toast.success('Game started!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSubmitOrder = async (quantity: number) => {
    if (!roomId) return;
    try {
      await api.submitOrder(roomId, quantity);
      setHasSubmittedOrder(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDraftOrderChange = (quantity: number) => {
    if (!roomId) return;
    api.updateDraft(roomId, quantity).catch(() => {});
  };

  const handleCopyRoomId = () => {
    if (roomId) {
      if (!navigator.clipboard?.writeText) {
        toast.info(`Room ID: ${roomId}`);
      } else {
        navigator.clipboard.writeText(roomId).catch(() => {
          toast.info(`Room ID: ${roomId}`);
        });
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLeave = () => {
    if (roomId) {
      api.leaveRoom(roomId).catch(() => {});
    }
    navigate('/');
  };

  const handleHostRoleChange = async (playerToken: string, role: Role) => {
    if (!roomId) return;
    try {
      await api.assignRoles(roomId, { [playerToken]: role });
    } catch (err: any) {
      toast.error('Could not change role');
    }
  };

  const handleAnonymousModeToggle = async (enabled: boolean) => {
    if (!roomId) return;
    try {
      await api.setAnonymousMode(roomId, enabled);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTimerConfigChange = async (field: keyof TimerConfig, value: number) => {
    if (!roomId) return;
    try {
      await api.updateConfig(roomId, { timerConfig: { [field]: value } as any });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const playerHistory = gamePoll?.myHistory || [];
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

  const timerState = gamePoll?.timer || roomState?.timerState;
  const remainingSeconds = timerState
    ? Math.max(0, Math.ceil((timerState.endsAtMs - nowMs) / 1000))
    : null;
  const minutes = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : 0;
  const seconds = remainingSeconds !== null ? remainingSeconds % 60 : 0;
  const timerLabel = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const timerConfig = roomState?.gameConfig?.timerConfig;

  // If game is over and we have full results
  if (gameOverState?.gameState) {
    return (
      <GameSummary
        gameState={gameOverState.gameState}
        onRestart={handleLeave}
        playerRoleOverride={myRole}
        privateView={true}
      />
    );
  }

  // If game is in progress
  if (gamePoll && myRole) {
    const playerStage = gamePoll.myStage;
    const waitingForOthers = hasSubmittedOrder;

    if (!playerStage) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading your role state...
          </div>
        </div>
      );
    }

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
                  {amController && <span className="text-xs text-muted-foreground ml-2">(Host)</span>}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Week {gamePoll.currentWeek} of {gamePoll.totalWeeks} · You are {ROLE_LABELS[myRole]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {timerState && (
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

          {timerState && (
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

          {/* Game content */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Place Your Order</h2>
                <MultiplayerOrderInput
                  role={myRole}
                  round={gamePoll.currentWeek}
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
                gameState={{
                  currentWeek: gamePoll.currentWeek,
                  totalWeeks: gamePoll.totalWeeks,
                  stages: { [myRole]: playerStage } as any,
                  history: { [myRole]: gamePoll.myHistory } as any,
                  config: roomState?.gameConfig,
                } as any}
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
                <GameCharts history={{ [myRole]: gamePoll.myHistory } as any} playerRole={myRole} />
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
  const isReady = myPlayer?.isReady ?? false;
  const roomTitle = roomState?.label || 'Game Lobby';
  const isInstructorManaged = roomState?.controllerMode === 'instructor';

  if (roomState?.status === 'playing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading game...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6 animate-fade-in">
        {/* Room Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-foreground">{roomTitle}</h1>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Room ID:</span>
            <code className="font-mono text-2xl font-bold text-primary tracking-widest">{roomId}</code>
            <Button variant="ghost" size="sm" onClick={handleCopyRoomId} className="h-8 w-8 p-0">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share the Room ID{roomState?.joinPasswordRequired ? ' and password' : ''} with your teammates
          </p>
        </div>

        {isInstructorManaged && (
          <div className="glass-card rounded-xl p-4 flex items-center gap-3 border border-primary/30 bg-primary/5">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Instructor-managed room</p>
              <p className="text-xs text-muted-foreground">
                The instructor controls role overrides, game settings, and when the session starts.
              </p>
            </div>
          </div>
        )}

        {/* Players */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Players ({playerCount}/4)</h2>
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(roomState?.players || []).map((player, index) => (
              <div key={player.sessionToken} className={cn(
                'rounded-lg p-3 border',
                player.isReady ? 'border-success/50 bg-success/5' : 'border-border bg-muted/30'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {(!roomState?.anonymousMode || amController) && player.isHost && <Crown className="h-3 w-3 text-primary" />}
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

        {amController && roomState?.status === 'lobby' && (
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
                <div key={player.sessionToken} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
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
                    onChange={(e) => handleHostRoleChange(player.sessionToken, e.target.value as Role)}
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

          {amController && (
            <Button
              onClick={handleStartGame}
              disabled={!allReady}
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
  }, [round, stage.lastOrderPlaced]);

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
