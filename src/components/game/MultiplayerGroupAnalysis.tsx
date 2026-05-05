import { GameResultsResponse } from '@/lib/apiTypes';
import { Role, ROLE_LABELS, SUPPLY_CHAIN_ORDER } from '@/types/game';
import { calculateSystemCost, calculateTotalCost } from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Award, BarChart3, RotateCcw, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface MultiplayerGroupAnalysisProps {
  results: GameResultsResponse;
  playerRole?: Role;
  onLeave: () => void;
}

const ROLE_COLORS: Record<Role, string> = {
  retailer: 'hsl(43, 96%, 56%)',
  wholesaler: 'hsl(174, 72%, 46%)',
  distributor: 'hsl(262, 83%, 68%)',
  factory: 'hsl(142, 76%, 46%)',
};

export function MultiplayerGroupAnalysis({ results, playerRole, onLeave }: MultiplayerGroupAnalysisProps) {
  const { gameState, bullwhipRatios } = results;
  const { stages, history } = gameState;
  const systemCost = calculateSystemCost(stages);

  const roleSummaries = SUPPLY_CHAIN_ORDER.map((role) => {
    const stage = stages[role];
    const roleHistory = history[role] || [];
    const totalCost = calculateTotalCost(stage);
    const maxInventory = roleHistory.length ? Math.max(...roleHistory.map((entry) => entry.inventory)) : 0;
    const maxBacklog = roleHistory.length ? Math.max(...roleHistory.map((entry) => entry.backlog)) : 0;
    const avgOrder = roleHistory.length
      ? roleHistory.reduce((sum, entry) => sum + entry.orderPlaced, 0) / roleHistory.length
      : 0;

    return {
      role,
      label: ROLE_LABELS[role],
      totalCost,
      inventoryCost: stage.totalInventoryCost,
      backlogCost: stage.totalBacklogCost,
      maxInventory,
      maxBacklog,
      avgOrder,
      bullwhip: bullwhipRatios[role] || 1,
    };
  });

  const rankedRoles = [...roleSummaries].sort((a, b) => a.totalCost - b.totalCost);
  const bestRole = rankedRoles[0];
  const highestBullwhip = [...roleSummaries].sort((a, b) => b.bullwhip - a.bullwhip)[0];
  const longestHistory = Math.max(...SUPPLY_CHAIN_ORDER.map((role) => history[role]?.length || 0), 0);

  const flowData = Array.from({ length: longestHistory }, (_unused, index) => {
    const point: Record<string, number> = { decision: index + 1 };
    SUPPLY_CHAIN_ORDER.forEach((role) => {
      const entry = history[role]?.[index];
      point[`${role}_inventory`] = entry?.inventory || 0;
      point[`${role}_backlog`] = entry?.backlog || 0;
      point[`${role}_orders`] = entry?.orderPlaced || 0;
    });
    return point;
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Award className="h-4 w-4" />
              Group analysis
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Simulation Results</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This screen compares only your room's roles against each other: cost, ordering swings, inventory pressure, and backlog pressure.
            </p>
          </div>

          <Button onClick={onLeave} variant="outline" className="gap-2 self-start">
            <RotateCcw className="h-4 w-4" />
            Back to Home
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <MetricTile label="Total System Cost" value={`$${systemCost.toFixed(2)}`} />
          <MetricTile label="Lowest Cost Role" value={bestRole.label} accent />
          <MetricTile label="Highest Bullwhip" value={`${highestBullwhip.label} ${highestBullwhip.bullwhip.toFixed(2)}x`} />
          <MetricTile label="Your Role" value={playerRole ? ROLE_LABELS[playerRole] : 'Observer'} />
        </div>

        <div className="grid lg:grid-cols-[0.95fr,1.05fr] gap-6">
          <section className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Role Cost Ranking</h2>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-3">
              {rankedRoles.map((summary, index) => {
                const isYou = summary.role === playerRole;
                return (
                  <div
                    key={summary.role}
                    className={cn(
                      'rounded-lg border p-4',
                      isYou ? 'border-primary/50 bg-primary/10' : 'border-border bg-muted/25'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-background"
                          style={{ backgroundColor: ROLE_COLORS[summary.role] }}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {summary.label} {isYou && <span className="text-xs text-primary">(You)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Inventory ${summary.inventoryCost.toFixed(2)} · Backlog ${summary.backlogCost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-foreground">${summary.totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Cost Breakdown</h2>
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleSummaries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis dataKey="label" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="inventoryCost" stackId="cost" fill="hsl(174, 72%, 46%)" name="Inventory Cost" />
                  <Bar dataKey="backlogCost" stackId="cost" fill="hsl(0, 84%, 60%)" name="Backlog Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Ordering Pattern Comparison</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                <XAxis dataKey="decision" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {SUPPLY_CHAIN_ORDER.map((role) => (
                  <Line
                    key={role}
                    type="monotone"
                    dataKey={`${role}_orders`}
                    stroke={ROLE_COLORS[role]}
                    strokeWidth={2}
                    dot={false}
                    name={`${ROLE_LABELS[role]} Orders`}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <FlowChart
            title="Inventory Pressure"
            data={flowData}
            suffix="inventory"
          />
          <FlowChart
            title="Backlog Pressure"
            data={flowData}
            suffix="backlog"
            dashed
          />
        </div>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Role Diagnostics</h2>
          <div className="grid md:grid-cols-4 gap-3">
            {roleSummaries.map((summary) => (
              <div key={summary.role} className="rounded-lg bg-muted/25 p-4">
                <p className="text-sm font-semibold text-foreground">{summary.label}</p>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p>Max inventory: <span className="text-foreground font-medium">{summary.maxInventory}</span></p>
                  <p>Max backlog: <span className="text-foreground font-medium">{summary.maxBacklog}</span></p>
                  <p>Avg order: <span className="text-foreground font-medium">{summary.avgOrder.toFixed(1)}</span></p>
                  <p>Bullwhip: <span className="text-foreground font-medium">{summary.bullwhip.toFixed(2)}x</span></p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl p-4', accent ? 'bg-primary/15 border border-primary/30' : 'bg-muted/25')}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-xl font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function FlowChart({
  title,
  data,
  suffix,
  dashed = false,
}: {
  title: string;
  data: Array<Record<string, number>>;
  suffix: 'inventory' | 'backlog';
  dashed?: boolean;
}) {
  return (
    <section className="glass-card rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
            <XAxis dataKey="decision" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
            <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            {SUPPLY_CHAIN_ORDER.map((role) => (
              <Line
                key={role}
                type="monotone"
                dataKey={`${role}_${suffix}`}
                stroke={ROLE_COLORS[role]}
                strokeWidth={2}
                strokeDasharray={dashed ? '5 5' : undefined}
                dot={false}
                name={ROLE_LABELS[role]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const tooltipStyle = {
  backgroundColor: 'hsl(222, 47%, 14%)',
  border: '1px solid hsl(217, 33%, 25%)',
  borderRadius: '8px',
};
