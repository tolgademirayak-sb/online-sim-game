import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as api from '@/lib/apiService';
import { toast } from 'sonner';

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export default function MultiplayerLobby() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleJoin = async () => {
    const name = playerName.trim();
    const code = normalizeCode(joinCode);

    if (!name) {
      toast.error('Please enter your name');
      return;
    }
    if (!code) {
      toast.error('Please enter a class code or room code');
      return;
    }

    setIsConnecting(true);
    try {
      await api.createSession(name);

      try {
        const classroomJoin = await api.joinClassroom(code, password || undefined);
        navigate(`/multiplayer/room/${classroomJoin.roomId}`, {
          state: { playerName: name, isHost: false },
        });
        return;
      } catch (classroomErr: any) {
        if (classroomErr.message !== 'Classroom not found') {
          throw classroomErr;
        }
      }

      await api.joinRoom(code, password || undefined);
      navigate(`/multiplayer/room/${code}`, {
        state: { playerName: name, isHost: false },
      });
    } catch (err: any) {
      const message = err.message === 'Room not found'
        ? 'Invalid class code or room code'
        : err.message || 'Failed to join';
      toast.error(message);
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        <Button variant="outline" onClick={() => navigate('/')} className="gap-2 border-border">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">Multiplayer</h1>
          <p className="text-sm text-muted-foreground">
            Enter your instructor's class code. A specific room code also works.
          </p>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold">Your Name</Label>
            <Input
              id="name"
              placeholder="Enter your name..."
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              className="bg-secondary border-border"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="join-code" className="text-sm font-semibold">Class Code or Room Code</Label>
            <Input
              id="join-code"
              placeholder="e.g. CLASS-A7K9 or A3X7KP"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              className="bg-secondary border-border font-mono text-lg tracking-widest"
              maxLength={16}
            />
            <p className="text-xs text-muted-foreground">
              Students normally join with one class code. Room codes are still supported for direct assignment.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="join-password" className="text-sm font-semibold">Password</Label>
            <Input
              id="join-password"
              type="password"
              placeholder="Only needed if your instructor set one..."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {isConnecting ? 'Joining...' : 'Join'}
          </Button>
        </div>

        <div className="text-center text-[11px] text-muted-foreground/60">
          Server-hosted game - Game state managed on the server
        </div>
      </div>
    </div>
  );
}
