import { DemandPattern } from '@/types/game';
import { cn } from '@/lib/utils';
import { TrendingUp, Shuffle, Zap, Waves } from 'lucide-react';

interface DemandPatternSelectorProps {
  selectedPattern: DemandPattern;
  onPatternSelect: (pattern: DemandPattern) => void;
}

const patterns: { value: DemandPattern; label: string; icon: typeof TrendingUp; description: string }[] = [
  { value: 'constant', label: 'Constant', icon: TrendingUp, description: 'Steady demand each week' },
  { value: 'random', label: 'Random', icon: Shuffle, description: 'Varying demand range' },
  { value: 'spike', label: 'Spike', icon: Zap, description: 'Step-up at a specific week' },
  { value: 'seasonal', label: 'Seasonal', icon: Waves, description: 'Sinusoidal pattern' },
];

export function DemandPatternSelector({ selectedPattern, onPatternSelect }: DemandPatternSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {patterns.map(({ value, label, icon: Icon, description }) => (
        <button
          key={value}
          onClick={() => onPatternSelect(value)}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200',
            selectedPattern === value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-secondary hover:border-muted-foreground text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[10px] text-center opacity-70">{description}</span>
        </button>
      ))}
    </div>
  );
}
