import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Role, ROLE_LABELS, GameState } from '@/types/game';
import { peerService, MultiplayerPlayer, RoomState } from '@/lib/peerService';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/game/RoleSelector';
import { GameSummary } from '@/components/game/GameSummary';
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
        toast.warning(`${msg.payload.playerName} disconnected`);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Only cleanup if navigating away (not on re-render)
    };
  }, []);

  const handleSelectRole = (role: Role) => {
    if (!roomId) return;
    peerService.selectRole(role);
    setMyRole(role);
  };

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

            {waitingForOthers && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Waiting for other players...
              </div>
            )}
          </div>

          {/* Reuse single-player components */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <div className="glass-card rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Place Your Order</h2>
                <MultiplayerOrderInput
                  stage={playerStage}
                  onSubmitOrder={handleSubmitOrder}
                  disabled={hasSubmittedOrder}
                />
                {hasSubmittedOrder && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3">
                    <CheckCircle2 className="h-4 w-4" />
                    Order submitted — waiting for others
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              {/* Supply chain overview - read only */}
              <div className="glass-card rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Supply Chain Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map(role => {
                    const stage = gameState.stages[role];
                    const isMe = role === myRole;
                    return (
                      <div key={role} className={cn(
                        'rounded-lg p-3 text-center',
                        isMe ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                      )}>
                        <p className={cn('text-xs font-medium mb-1', isMe ? 'text-primary' : 'text-muted-foreground')}>
                          {ROLE_LABELS[role]} {isMe && '(You)'}
                        </p>
                        <p className="text-lg font-bold text-success">{stage.inventory}</p>
                        <p className="text-[10px] text-muted-foreground">inventory</p>
                        {stage.backlog > 0 && (
                          <p className="text-xs text-destructive font-medium">-{stage.backlog} backlog</p>
                        )}
                      </div>
                    );
                  })}
                </div>
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
            {(roomState?.players || []).map(player => (
              <div key={player.id} className={cn(
                'rounded-lg p-3 border',
                player.isReady ? 'border-success/50 bg-success/5' : 'border-border bg-muted/30'
              )}>
                <div className="flex items-center gap-2 mb-1">
                  {player.isHost && <Crown className="h-3 w-3 text-primary" />}
                  <span className="text-sm font-medium text-foreground">{player.name}</span>
                  {player.isReady && <CheckCircle2 className="h-3 w-3 text-success ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {player.role ? ROLE_LABELS[player.role] : 'Choosing role...'}
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

        {/* Role Selection */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Choose Your Role</h2>
          <RoleSelector
            selectedRole={myRole || 'retailer'}
            onRoleSelect={handleSelectRole}
            disabledRoles={roomState?.players?.filter(p => p.role && p.name !== playerName).map(p => p.role!) || []}
          />
        </div>

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
function MultiplayerOrderInput({ stage, onSubmitOrder, disabled }: {
  stage: { inventory: number; backlog: number; incomingOrders: number };
  onSubmitOrder: (q: number) => void;
  disabled: boolean;
}) {
  const [qty, setQty] = useState(4);
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
          <p className="text-muted-foreground">Orders In</p>
          <p className="text-lg font-bold text-accent">{stage.incomingOrders}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={999}
          value={qty}
          onChange={e => setQty(Math.max(0, parseInt(e.target.value) || 0))}
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
