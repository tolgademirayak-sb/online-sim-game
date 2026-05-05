import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, BarChart3, Loader2, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import * as api from '@/lib/apiService';
import type { ClassroomAnalysisResponse, ClassroomTeamAnalysis } from '@/lib/apiTypes';
import { ROLE_LABELS, Role, SUPPLY_CHAIN_ORDER } from '@/types/game';
import { toast } from 'sonner';

const TEAM_COLORS = [
  'hsl(43, 96%, 56%)',
  'hsl(174, 72%, 46%)',
  'hsl(262, 83%, 68%)',
  'hsl(142, 76%, 46%)',
  'hsl(0, 84%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(31, 92%, 58%)',
  'hsl(330, 81%, 60%)',
];

function teamName(team: ClassroomTeamAnalysis): string {
  return team.label || `Team ${team.teamNumber}`;
}

function roleCost(team: ClassroomTeamAnalysis, role: Role): number {
  return team.gameState.history[role]?.reduce((sum, record) => sum + record.cost, 0) || 0;
}

function totalCost(team: ClassroomTeamAnalysis): number {
  return SUPPLY_CHAIN_ORDER.reduce((sum, role) => sum + roleCost(team, role), 0);
}

function averageBullwhip(team: ClassroomTeamAnalysis): number {
  return SUPPLY_CHAIN_ORDER.reduce((sum, role) => sum + team.bullwhipRatios[role], 0) / SUPPLY_CHAIN_ORDER.length;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.00x';
  }
  return `${value.toFixed(2)}x`;
}

export default function ClassroomAnalysis() {
  const navigate = useNavigate();
  const { classCode } = useParams();
  const [analysis, setAnalysis] = useState<ClassroomAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!classCode) {
      return;
    }

    api.getClassroomAnalysis(classCode)
      .then(setAnalysis)
      .catch((err: any) => {
        toast.error(err.message || 'Could not load classroom analysis');
      })
      .finally(() => setIsLoading(false));
  }, [classCode]);

  const derived = useMemo(() => {
    const teams = analysis?.teams || [];
    const rankedByCost = [...teams]
      .map((team) => ({
        team,
        name: teamName(team),
        totalCost: totalCost(team),
        averageBullwhip: averageBullwhip(team),
      }))
      .sort((a, b) => a.totalCost - b.totalCost);

    const costChart = rankedByCost.map((entry, index) => ({
      name: entry.name,
      totalCost: entry.totalCost,
      rank: index + 1,
    }));

    const bullwhipChart = teams.map((team) => ({
      name: teamName(team),
      average: averageBullwhip(team),
      retailer: team.bullwhipRatios.retailer,
      wholesaler: team.bullwhipRatios.wholesaler,
      distributor: team.bullwhipRatios.distributor,
      factory: team.bullwhipRatios.factory,
    }));

    const ladderData = SUPPLY_CHAIN_ORDER.map((role) => {
      const point: Record<string, string | number> = { role: ROLE_LABELS[role] };
      teams.forEach((team) => {
        point[teamName(team)] = team.bullwhipRatios[role];
      });
      return point;
    });

    const best = rankedByCost[0] || null;
    const highestAmplification = [...rankedByCost].sort((a, b) => b.averageBullwhip - a.averageBullwhip)[0] || null;

    return { rankedByCost, costChart, bullwhipChart, ladderData, best, highestAmplification };
  }, [analysis]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading classroom analysis...
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 text-center space-y-4">
          <p className="text-foreground font-semibold">Analysis is not available yet.</p>
          <Button variant="outline" onClick={() => navigate('/instructor')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Instructor
          </Button>
        </div>
      </div>
    );
  }

  const teams = analysis.teams;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/instructor')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <p className="font-mono text-sm text-primary">{analysis.classCode}</p>
              <h1 className="text-3xl font-bold text-foreground">{analysis.label} Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Compare team decisions, cost discipline, and order amplification across the classroom.
              </p>
            </div>
          </div>
        </div>

        <section className="grid md:grid-cols-3 gap-4">
          <InsightTile
            icon={<Award className="h-5 w-5 text-primary" />}
            label="Lowest Total Cost"
            value={derived.best ? `${derived.best.name} - ${formatNumber(derived.best.totalCost)}` : 'No data'}
            note="Use this as the operational benchmark for the class discussion."
          />
          <InsightTile
            icon={<TrendingUp className="h-5 w-5 text-accent" />}
            label="Highest Average Bullwhip"
            value={derived.highestAmplification ? `${derived.highestAmplification.name} - ${formatRatio(derived.highestAmplification.averageBullwhip)}` : 'No data'}
            note="This team shows the strongest demand signal amplification."
          />
          <InsightTile
            icon={<BarChart3 className="h-5 w-5 text-success" />}
            label="Teams Compared"
            value={`${teams.length}`}
            note="Each team ran an isolated 4-seat Beer Game room."
          />
        </section>

        <section className="grid xl:grid-cols-[1fr,0.85fr] gap-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Total Cost Ranking</h2>
              <p className="text-sm text-muted-foreground">
                Lower cost means the team balanced inventory and backlog pressure more effectively.
              </p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={derived.costChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis dataKey="name" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatNumber(value)} />
                  <Bar dataKey="totalCost" name="Total Cost" radius={[6, 6, 0, 0]}>
                    {derived.costChart.map((_, index) => (
                      <Cell key={index} fill={TEAM_COLORS[index % TEAM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Ranking Table</h2>
              <p className="text-sm text-muted-foreground">Total cost includes all four roles.</p>
            </div>
            <div className="space-y-3">
              {derived.rankedByCost.map((entry, index) => (
                <div key={entry.team.roomId} className="rounded-xl bg-muted/25 p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">Average bullwhip {formatRatio(entry.averageBullwhip)}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">{formatNumber(entry.totalCost)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid xl:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Average Bullwhip by Team</h2>
              <p className="text-sm text-muted-foreground">
                High ratios mean order decisions became more volatile than customer demand.
              </p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={derived.bullwhipChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis dataKey="name" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatRatio(value)} />
                  <Bar dataKey="average" name="Average Bullwhip" radius={[6, 6, 0, 0]} fill="hsl(174, 72%, 46%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Amplification Ladder</h2>
              <p className="text-sm text-muted-foreground">
                A classic bullwhip pattern rises as we move from retailer toward factory.
              </p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={derived.ladderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis dataKey="role" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatRatio(value)} />
                  <Legend />
                  {teams.map((team, index) => (
                    <Line
                      key={team.roomId}
                      type="monotone"
                      dataKey={teamName(team)}
                      stroke={TEAM_COLORS[index % TEAM_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Role Cost Breakdown</h2>
            <p className="text-sm text-muted-foreground">
              Compare where each team paid for inventory buffers or backlog delays.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Team</th>
                  {SUPPLY_CHAIN_ORDER.map((role) => (
                    <th key={role} className="py-3 pr-4 font-medium">{ROLE_LABELS[role]}</th>
                  ))}
                  <th className="py-3 pr-4 font-medium">Total Cost</th>
                  <th className="py-3 pr-4 font-medium">Avg. Bullwhip</th>
                </tr>
              </thead>
              <tbody>
                {derived.rankedByCost.map((entry) => (
                  <tr key={entry.team.roomId} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-semibold text-foreground">{entry.name}</td>
                    {SUPPLY_CHAIN_ORDER.map((role) => (
                      <td key={role} className="py-3 pr-4 text-muted-foreground">{formatNumber(roleCost(entry.team, role))}</td>
                    ))}
                    <td className="py-3 pr-4 font-bold text-foreground">{formatNumber(entry.totalCost)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatRatio(entry.averageBullwhip)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'hsl(222, 47%, 14%)',
  border: '1px solid hsl(217, 33%, 25%)',
  borderRadius: '8px',
  color: 'hsl(210, 40%, 98%)',
};

function InsightTile({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted/30 p-2">{icon}</div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
