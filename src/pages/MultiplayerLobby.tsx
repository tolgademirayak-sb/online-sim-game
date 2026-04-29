import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as api from '@/lib/apiService';
import { DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG, DemandPattern } from '@/types/game';
import { ArrowLeft, Plus, LogIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type LobbyMode = 'select' | 'create' | 'join';

export default function MultiplayerLobby() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<LobbyMode>('select');
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [demandPattern, setDemandPattern] = useState<DemandPattern>(DEFAULT_CONFIG.demandPattern);
  const [baseDemand, setBaseDemand] = useState(DEFAULT_DEMAND_CONFIG.baseDemand);
  const [spikeWeek, setSpikeWeek] = useState(DEFAULT_DEMAND_CONFIG.spikeWeek);
  const [spikeAmount, setSpikeAmount] = useState(DEFAULT_DEMAND_CONFIG.spikeAmount);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setIsConnecting(true);
    try {
      await api.createSession(playerName.trim());
      const newRoomId = await api.createRoom(password || undefined, {
        demandPattern,
        demandConfig: {
          ...DEFAULT_DEMAND_CONFIG,
          baseDemand,
          spikeWeek,
          spikeAmount,
        },
      });
      navigate(`/multiplayer/room/${newRoomId}`, {
        state: { playerName: playerName.trim(), isHost: true },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create room');
      setIsConnecting(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!roomId.trim()) {
      toast.error('Please enter a room ID');
      return;
    }
    setIsConnecting(true);
    try {
      await api.createSession(playerName.trim());
      await api.joinRoom(roomId.trim().toUpperCase(), password || undefined);
      navigate(`/multiplayer/room/${roomId.trim().toUpperCase()}`, {
        state: { playerName: playerName.trim(), isHost: false },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to join room');
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Back */}
        <Button variant="outline" onClick={() => mode === 'select' ? navigate('/') : setMode('select')} className="gap-2 border-border">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">Multiplayer</h1>
          <p className="text-sm text-muted-foreground">Create or join a game room</p>
        </div>

        {mode === 'select' && (
          <div className="space-y-4">
            {/* Player Name (shared) */}
            <div className="glass-card rounded-xl p-5 space-y-3">
              <Label htmlFor="name" className="text-sm font-semibold">Your Name</Label>
              <Input
                id="name"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-secondary border-border"
                maxLength={20}
              />
            </div>

            <button
              onClick={() => setMode('create')}
              className="w-full glass-card rounded-xl p-5 flex items-center gap-4 hover:border-primary/50 transition-all group text-left"
            >
              <div className="rounded-full bg-primary/20 p-3 group-hover:bg-primary/30 transition-colors">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Create Room</h3>
                <p className="text-xs text-muted-foreground">Host a new game session</p>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full glass-card rounded-xl p-5 flex items-center gap-4 hover:border-accent/50 transition-all group text-left"
            >
              <div className="rounded-full bg-accent/20 p-3 group-hover:bg-accent/30 transition-colors">
                <LogIn className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Join Room</h3>
                <p className="text-xs text-muted-foreground">Enter with room ID & password</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-foreground">Create New Room</h2>

            <div className="space-y-2">
              <Label htmlFor="create-password" className="text-sm text-muted-foreground">Room Password</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Optional password for your room..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary border-border"
                maxLength={32}
              />
              <p className="text-xs text-muted-foreground">Leave blank for a room-ID-only join flow</p>
            </div>

            <div className="space-y-3 rounded-lg bg-muted/20 p-4">
              <Label className="text-sm font-semibold">Demand Pattern</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['constant', 'spike'] as DemandPattern[]).map((pattern) => (
                  <button
                    key={pattern}
                    onClick={() => setDemandPattern(pattern)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      demandPattern === pattern
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-secondary text-muted-foreground'
                    }`}
                  >
                    {pattern === 'constant' ? 'Constant' : 'Spike'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="base-demand" className="text-xs text-muted-foreground">Base Demand</Label>
                  <Input
                    id="base-demand"
                    type="number"
                    min={1}
                    max={20}
                    value={baseDemand}
                    onChange={(e) => setBaseDemand(Math.max(1, parseInt(e.target.value) || DEFAULT_DEMAND_CONFIG.baseDemand))}
                    className="bg-secondary border-border"
                  />
                </div>

                {demandPattern === 'spike' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="spike-week" className="text-xs text-muted-foreground">Spike Week</Label>
                      <Input
                        id="spike-week"
                        type="number"
                        min={3}
                        max={35}
                        value={spikeWeek}
                        onChange={(e) => setSpikeWeek(Math.max(3, parseInt(e.target.value) || DEFAULT_DEMAND_CONFIG.spikeWeek))}
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="spike-amount" className="text-xs text-muted-foreground">Spike Amount</Label>
                      <Input
                        id="spike-amount"
                        type="number"
                        min={1}
                        max={50}
                        value={spikeAmount}
                        onChange={(e) => setSpikeAmount(Math.max(1, parseInt(e.target.value) || DEFAULT_DEMAND_CONFIG.spikeAmount))}
                        className="bg-secondary border-border"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={isConnecting}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {isConnecting ? 'Creating Room...' : 'Create Room'}
            </Button>
          </div>
        )}

        {mode === 'join' && (
          <div className="glass-card rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-foreground">Join Existing Room</h2>

            <div className="space-y-2">
              <Label htmlFor="room-id" className="text-sm text-muted-foreground">Room ID</Label>
              <Input
                id="room-id"
                placeholder="e.g. A3X7KP"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="bg-secondary border-border font-mono text-lg tracking-widest"
                maxLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="join-password" className="text-sm text-muted-foreground">Password</Label>
              <Input
                id="join-password"
                type="password"
                placeholder="Only needed if the room uses one..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary border-border"
                maxLength={32}
              />
            </div>

            <Button
              onClick={handleJoin}
              disabled={isConnecting}
              className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-12"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {isConnecting ? 'Connecting...' : 'Join Room'}
            </Button>
          </div>
        )}

        <div className="text-center text-[11px] text-muted-foreground/60">
          Server-hosted game · Game state managed on the server
        </div>
      </div>
    </div>
  );
}
