import { useState } from 'react';
import { Role, DemandPattern, DemandConfig, DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG, ROLE_LABELS } from '@/types/game';
import { RoleSelector } from './RoleSelector';
import { DemandPatternSelector } from './DemandPatternSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Beer, PlayCircle, Info, Truck } from 'lucide-react';

interface GameSetupProps {
  onStartGame: (config: {
    role: Role;
    weeks: number;
    demandPattern: DemandPattern;
    demandConfig: DemandConfig;
    orderDelay: number;
    shipmentDelay: number;
  }) => void;
}

export function GameSetup({ onStartGame }: GameSetupProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(DEFAULT_CONFIG.playerRole);
  const [weeks, setWeeks] = useState(DEFAULT_CONFIG.totalWeeks);
  const [demandPattern, setDemandPattern] = useState<DemandPattern>(DEFAULT_CONFIG.demandPattern);
  const [demandConfig, setDemandConfig] = useState<DemandConfig>(DEFAULT_DEMAND_CONFIG);
  const [orderDelay, setOrderDelay] = useState(DEFAULT_CONFIG.orderDelay);
  const [shipmentDelay, setShipmentDelay] = useState(DEFAULT_CONFIG.shipmentDelay);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleStart = () => {
    onStartGame({ role: selectedRole, weeks, demandPattern, demandConfig, orderDelay, shipmentDelay });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="rounded-full bg-primary/20 p-4 animate-pulse-glow">
              <Beer className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold gradient-text">The Beer Game</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            MIT's classic supply chain simulation. Experience the bullwhip effect firsthand.
          </p>
        </div>

        {/* Game Rules Card */}
        <div className="glass-card rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Quick Rules</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Each week, decide how many units to order from your supplier</li>
            <li>Orders and shipments have configurable delays (default: <span className="text-primary font-medium">2 weeks</span>)</li>
            <li>Minimize total cost: inventory ($0.50/unit) + backlog ($1.00/unit)</li>
            <li>You only see orders from your direct customer</li>
          </ul>
        </div>

        {/* Setup Form */}
        <div className="glass-card rounded-xl p-6 space-y-6">
          {/* Role Selection */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Choose Your Role</Label>
            <RoleSelector selectedRole={selectedRole} onRoleSelect={setSelectedRole} />
          </div>

          {/* Demand Pattern */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Customer Demand Pattern</Label>
            <DemandPatternSelector selectedPattern={demandPattern} onPatternSelect={setDemandPattern} />
          </div>

          {/* Demand Pattern Parameters */}
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <Label className="text-sm font-semibold text-muted-foreground">Demand Parameters</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="baseDemand" className="text-xs text-muted-foreground">Base Demand</Label>
                <Input
                  id="baseDemand"
                  type="number"
                  min={1}
                  max={20}
                  value={demandConfig.baseDemand}
                  onChange={(e) => setDemandConfig(prev => ({ ...prev, baseDemand: Math.max(1, parseInt(e.target.value) || 4) }))}
                  className="h-9 bg-secondary border-border"
                />
              </div>
              {demandPattern === 'spike' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="spikeWeek" className="text-xs text-muted-foreground">Spike at Week</Label>
                    <Input
                      id="spikeWeek"
                      type="number"
                      min={1}
                      max={weeks}
                      value={demandConfig.spikeWeek}
                      onChange={(e) => setDemandConfig(prev => ({ ...prev, spikeWeek: Math.max(1, parseInt(e.target.value) || 5) }))}
                      className="h-9 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="spikeAmount" className="text-xs text-muted-foreground">Spike Amount</Label>
                    <Input
                      id="spikeAmount"
                      type="number"
                      min={1}
                      max={50}
                      value={demandConfig.spikeAmount}
                      onChange={(e) => setDemandConfig(prev => ({ ...prev, spikeAmount: Math.max(1, parseInt(e.target.value) || 8) }))}
                      className="h-9 bg-secondary border-border"
                    />
                  </div>
                </>
              )}
              {demandPattern === 'random' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="randomMin" className="text-xs text-muted-foreground">Min Demand</Label>
                    <Input
                      id="randomMin"
                      type="number"
                      min={0}
                      max={demandConfig.randomMax - 1}
                      value={demandConfig.randomMin}
                      onChange={(e) => setDemandConfig(prev => ({ ...prev, randomMin: Math.max(0, Math.min(prev.randomMax - 1, parseInt(e.target.value) || 2)) }))}
                      className="h-9 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="randomMax" className="text-xs text-muted-foreground">Max Demand</Label>
                    <Input
                      id="randomMax"
                      type="number"
                      min={demandConfig.randomMin + 1}
                      max={50}
                      value={demandConfig.randomMax}
                      onChange={(e) => setDemandConfig(prev => ({ ...prev, randomMax: Math.max(demandConfig.randomMin + 1, parseInt(e.target.value) || 8) }))}
                      className="h-9 bg-secondary border-border"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Delays */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <Label className="text-lg font-semibold">Delays</Label>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm text-muted-foreground">Order Delay</Label>
                  <span className="text-sm font-bold text-primary">{orderDelay} week{orderDelay !== 1 ? 's' : ''}</span>
                </div>
                <Slider
                  value={[orderDelay]}
                  onValueChange={([val]) => setOrderDelay(val)}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm text-muted-foreground">Shipping Delay</Label>
                  <span className="text-sm font-bold text-primary">{shipmentDelay} week{shipmentDelay !== 1 ? 's' : ''}</span>
                </div>
                <Slider
                  value={[shipmentDelay]}
                  onValueChange={([val]) => setShipmentDelay(val)}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>
            </div>
          </div>

          {/* Weeks */}
          <div className="space-y-2">
            <Label htmlFor="weeks" className="text-lg font-semibold">
              Simulation Length
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="weeks"
                type="number"
                min={10}
                max={100}
                value={weeks}
                onChange={(e) => setWeeks(Math.max(10, Math.min(100, parseInt(e.target.value) || 50)))}
                className="w-24 bg-secondary border-border"
              />
              <span className="text-muted-foreground">weeks</span>
            </div>
          </div>

          {/* Start Button */}
          <Button
            onClick={handleStart}
            size="lg"
            className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-14 text-lg glow-primary"
          >
            <PlayCircle className="h-6 w-6" />
            Start Simulation as {ROLE_LABELS[selectedRole]}
          </Button>
        </div>
      </div>
    </div>
  );
}
