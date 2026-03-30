import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Beer, Users, User, GraduationCap } from 'lucide-react';

export default function StartPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="rounded-full bg-primary/20 p-5 animate-pulse-glow">
              <Beer className="h-14 w-14 text-primary" />
            </div>
          </div>
          <h1 className="text-5xl font-bold gradient-text">The Beer Game</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            MIT's classic supply chain simulation. Experience the bullwhip effect firsthand.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="space-y-4">
          <button
            onClick={() => navigate('/singleplayer')}
            className="w-full glass-card rounded-xl p-6 flex items-center gap-5 hover:border-primary/50 transition-all duration-300 group text-left"
          >
            <div className="rounded-full bg-primary/20 p-4 group-hover:bg-primary/30 transition-colors">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Single Player</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Play against AI opponents. Choose your role and compete.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/multiplayer')}
            className="w-full glass-card rounded-xl p-6 flex items-center gap-5 hover:border-accent/50 transition-all duration-300 group text-left"
          >
            <div className="rounded-full bg-accent/20 p-4 group-hover:bg-accent/30 transition-colors">
              <Users className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Multiplayer</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create or join a room. Play with up to 4 players in real-time.
              </p>
            </div>
          </button>
        </div>

        {/* Instructor Link */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => navigate('/instructor')}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <GraduationCap className="h-4 w-4" />
            Instructor Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
