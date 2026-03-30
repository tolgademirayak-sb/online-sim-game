import { StageState, ROLE_LABELS, Role } from '@/types/game';
import { cn } from '@/lib/utils';
import { Package, AlertTriangle, ArrowDown, ArrowUp, Box, TrendingDown } from 'lucide-react';

interface StageCardProps {
  stage: StageState;
  isPlayer: boolean;
  isActive?: boolean;
}

export function StageCard({ stage, isPlayer, isActive }: StageCardProps) {
  const hasBacklog = stage.backlog > 0;
  const lowInventory = stage.inventory < 8;

  return (
    <div
      className={cn(
        'glass-card rounded-xl p-4 transition-all duration-300',
        isPlayer && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        isActive && 'scale-105'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{ROLE_LABELS[stage.role]}</h3>
          {isPlayer && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">You</span>
          )}
        </div>
        {hasBacklog && (
          <div className="flex items-center gap-1 text-destructive text-xs">
            <AlertTriangle className="h-3 w-3" />
            Backlog
          </div>
        )}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Inventory */}
        <div
          className={cn(
            'rounded-lg p-3 text-center',
            lowInventory ? 'bg-warning/10 border border-warning/30' : 'bg-success/10 border border-success/30'
          )}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Box className={cn('h-4 w-4', lowInventory ? 'text-warning' : 'text-success')} />
            <span className="text-xs text-muted-foreground">Inventory</span>
          </div>
          <p className={cn('text-2xl font-bold', lowInventory ? 'text-warning' : 'text-success')}>
            {stage.inventory}
          </p>
        </div>

        {/* Backlog */}
        <div
          className={cn(
            'rounded-lg p-3 text-center',
            hasBacklog ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted border border-border'
          )}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className={cn('h-4 w-4', hasBacklog ? 'text-destructive' : 'text-muted-foreground')} />
            <span className="text-xs text-muted-foreground">Backlog</span>
          </div>
          <p className={cn('text-2xl font-bold', hasBacklog ? 'text-destructive' : 'text-muted-foreground')}>
            {stage.backlog}
          </p>
        </div>
      </div>

      {/* Flow Stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <ArrowDown className="h-3 w-3 text-accent" />
          <span className="text-muted-foreground">In Orders:</span>
          <span className="font-medium text-foreground ml-auto">{stage.incomingOrders}</span>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <ArrowUp className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">Shipped:</span>
          <span className="font-medium text-foreground ml-auto">{stage.outgoingShipments}</span>
        </div>
      </div>

      {/* Last Order */}
      <div className="mt-2 flex items-center justify-between text-xs bg-secondary/50 rounded-lg px-3 py-2">
        <span className="text-muted-foreground">Last Order Placed:</span>
        <span className="font-medium text-primary">{stage.lastOrderPlaced} units</span>
      </div>
    </div>
  );
}
