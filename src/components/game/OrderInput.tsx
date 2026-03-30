import { useState } from 'react';
import { StageState, ROLE_LABELS } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Package, AlertTriangle, ArrowDown, Lightbulb } from 'lucide-react';

interface OrderInputProps {
  stage: StageState;
  onSubmitOrder: (quantity: number) => void;
  disabled?: boolean;
  shipmentDelay?: number;
  orderDelay?: number;
}

export function OrderInput({ stage, onSubmitOrder, disabled, shipmentDelay = 2, orderDelay = 2 }: OrderInputProps) {
  const [orderQuantity, setOrderQuantity] = useState(4);
  
  const suggestedOrder = Math.max(0, 12 - stage.inventory + stage.backlog + stage.incomingOrders);

  const handleSubmit = () => {
    onSubmitOrder(Math.max(0, orderQuantity));
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Place Your Order</h2>
        <span className="text-sm text-muted-foreground">{ROLE_LABELS[stage.role]}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Package className="h-4 w-4 text-success" />
          </div>
          <p className="text-xs text-muted-foreground">Inventory</p>
          <p className="text-xl font-bold text-success">{stage.inventory}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-xs text-muted-foreground">Backlog</p>
          <p className="text-xl font-bold text-destructive">{stage.backlog}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ArrowDown className="h-4 w-4 text-accent" />
          </div>
          <p className="text-xs text-muted-foreground">Incoming Orders</p>
          <p className="text-xl font-bold text-accent">{stage.incomingOrders}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="order" className="text-sm text-muted-foreground">
              Order Quantity
            </Label>
            <Input
              id="order"
              type="number"
              min={0}
              max={999}
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
              className="mt-1 text-2xl font-bold h-14 bg-secondary border-border text-center"
              disabled={disabled}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={disabled}
            size="lg"
            className="h-14 px-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Send className="h-5 w-5" />
            Order
          </Button>
        </div>

        <div className="flex items-start gap-2 bg-primary/10 rounded-lg p-3 text-sm">
          <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-muted-foreground">
            <span className="text-primary font-medium">Suggestion:</span> Order{' '}
            <span className="text-primary font-bold">{suggestedOrder}</span> units to maintain target inventory
            of 12 units.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        ⏱️ Orders take <span className="text-primary font-medium">{orderDelay} week{orderDelay !== 1 ? 's' : ''}</span> to process · 
        Shipments take <span className="text-primary font-medium">{shipmentDelay} week{shipmentDelay !== 1 ? 's' : ''}</span> to arrive
      </p>
    </div>
  );
}
