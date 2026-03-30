import { useState, useMemo } from 'react';
import { Role, ROLE_LABELS, SUPPLY_CHAIN_ORDER, DemandPattern, WeeklyRecord } from '@/types/game';
import { runAutomatedSimulation, calculateTotalCost, calculateOrderVariance, calculateBullwhipRatio } from '@/lib/gameLogic';
import { Button } from '@/components/ui/button';
import { GameCharts } from '@/components/game/GameCharts';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, TrendingUp, AlertTriangle, BarChart3, Zap } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

const chartColors: Record<Role, string> = {
  retailer: 'hsl(43, 96%, 56%)',
  wholesaler: 'hsl(174, 72%, 46%)',
  distributor: 'hsl(262, 83%, 68%)',
  factory: 'hsl(142, 76%, 46%)',
};

const tooltipStyle = {
  backgroundColor: 'hsl(222, 47%, 14%)',
  border: '1px solid hsl(217, 33%, 25%)',
  borderRadius: '8px',
};

export default function InstructorDashboard() {
  const navigate = useNavigate();

  // Pre-run scenarios
  const bullwhipScenario = useMemo(() => {
    return runAutomatedSimulation({
      totalWeeks: 35,
      demandPattern: 'spike',
      playerRole: 'retailer',
      demandConfig: { baseDemand: 4, spikeWeek: 5, spikeAmount: 8, randomMin: 2, randomMax: 8 },
      orderDelay: 2,
      shipmentDelay: 2,
    });
  }, []);

  const highVarianceScenario = useMemo(() => {
    return runAutomatedSimulation({
      totalWeeks: 35,
      demandPattern: 'spike',
      playerRole: 'retailer',
      demandConfig: { baseDemand: 4, spikeWeek: 4, spikeAmount: 12, randomMin: 2, randomMax: 8 },
      orderDelay: 3,
      shipmentDelay: 3,
    });
  }, []);

  // Compute bullwhip data - order variance amplification
  const bullwhipOrderData = bullwhipScenario.history.retailer.map((_, i) => {
    const point: Record<string, number> = { week: i + 1 };
    SUPPLY_CHAIN_ORDER.forEach(role => {
      point[role] = bullwhipScenario.history[role][i]?.orderPlaced || 0;
    });
    point['customerDemand'] = bullwhipScenario.customerDemand[i] || 4;
    return point;
  });

  const highVarOrderData = highVarianceScenario.history.retailer.map((_, i) => {
    const point: Record<string, number> = { week: i + 1 };
    SUPPLY_CHAIN_ORDER.forEach(role => {
      point[role] = highVarianceScenario.history[role][i]?.orderPlaced || 0;
    });
    point['customerDemand'] = highVarianceScenario.customerDemand[i] || 4;
    return point;
  });

  // Variance bar data
  const bullwhipVarianceData = SUPPLY_CHAIN_ORDER.map(role => ({
    role: ROLE_LABELS[role],
    variance: Math.round(calculateOrderVariance(bullwhipScenario.history[role]) * 100) / 100,
    cost: Math.round(calculateTotalCost(bullwhipScenario.stages[role]) * 100) / 100,
  }));

  const highVarVarianceData = SUPPLY_CHAIN_ORDER.map(role => ({
    role: ROLE_LABELS[role],
    variance: Math.round(calculateOrderVariance(highVarianceScenario.history[role]) * 100) / 100,
    cost: Math.round(calculateTotalCost(highVarianceScenario.stages[role]) * 100) / 100,
  }));

  // Inventory data for high variance
  const highVarInventoryData = highVarianceScenario.history.retailer.map((_, i) => {
    const point: Record<string, number> = { week: i + 1 };
    SUPPLY_CHAIN_ORDER.forEach(role => {
      point[`${role}_inv`] = highVarianceScenario.history[role][i]?.inventory || 0;
      point[`${role}_back`] = -(highVarianceScenario.history[role][i]?.backlog || 0);
    });
    return point;
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')} className="gap-2 border-border">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <GraduationCap className="h-8 w-8 text-primary" />
                Instructor Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Pre-computed simulation scenarios for classroom discussion</p>
            </div>
          </div>
        </div>

        {/* Scenario 1: Classic Bullwhip Effect */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/20 p-2">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Scenario 1: Classic Bullwhip Effect</h2>
              <p className="text-sm text-muted-foreground">
                Demand steps from 4→8 at week 5 · Order delay: 2 weeks · Shipping delay: 2 weeks
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Order Patterns */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Order Patterns by Stage</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Notice how order variability <span className="text-primary font-medium">amplifies upstream</span>. 
                The factory's orders swing wildly compared to actual customer demand.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bullwhipOrderData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                    <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(210, 40%, 98%)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="customerDemand" stroke="hsl(0, 0%, 60%)" strokeWidth={3} strokeDasharray="8 4" dot={false} name="Customer Demand" />
                    {SUPPLY_CHAIN_ORDER.map(role => (
                      <Line key={role} type="monotone" dataKey={role} stroke={chartColors[role]} strokeWidth={2} dot={false} name={`${ROLE_LABELS[role]} Orders`} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Variance Comparison */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Order Variance & Cost by Stage</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Variance increases as we move <span className="text-primary font-medium">upstream</span> — 
                the hallmark of the bullwhip effect.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bullwhipVarianceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                    <XAxis dataKey="role" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(210, 40%, 98%)' }} />
                    <Legend />
                    <Bar dataKey="variance" fill="hsl(43, 96%, 56%)" name="Order Variance" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" fill="hsl(174, 72%, 46%)" name="Total Cost ($)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className="glass-card rounded-xl p-4 border-l-4 border-primary">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary font-semibold">Key Insight:</span> Even though customer demand only changed once (4→8), 
              each stage amplifies the signal. The factory may order 20+ units in panic, then crash to 0 — 
              a classic <span className="text-primary font-medium">bullwhip oscillation</span>.
            </p>
          </div>
        </section>

        {/* Scenario 2: High Variance — Wholesaler/Distributor Burns */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/20 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Scenario 2: Middle Stages Get Burned</h2>
              <p className="text-sm text-muted-foreground">
                Demand spikes 4→12 at week 4 · Order delay: 3 weeks · Shipping delay: 3 weeks (longer delays amplify variance)
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Order Patterns */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Order Patterns — Extreme Amplification</h3>
              <p className="text-xs text-muted-foreground mb-3">
                With <span className="text-destructive font-medium">longer delays</span> and a <span className="text-destructive font-medium">bigger spike</span>, 
                the wholesaler and distributor over-order massively, then face huge backlogs.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={highVarOrderData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                    <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(210, 40%, 98%)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="customerDemand" stroke="hsl(0, 0%, 60%)" strokeWidth={3} strokeDasharray="8 4" dot={false} name="Customer Demand" />
                    {SUPPLY_CHAIN_ORDER.map(role => (
                      <Line key={role} type="monotone" dataKey={role} stroke={chartColors[role]} strokeWidth={2} dot={false} name={`${ROLE_LABELS[role]} Orders`} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory vs Backlog */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Inventory (↑) vs Backlog (↓)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Positive = excess inventory (holding cost). Negative = backlog (penalty cost). 
                Middle stages swing between <span className="text-destructive font-medium">stockouts and overstocking</span>.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={highVarInventoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                    <XAxis dataKey="week" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(210, 40%, 98%)' }} />
                    <Legend />
                    {SUPPLY_CHAIN_ORDER.map(role => (
                      <Line key={`${role}_inv`} type="monotone" dataKey={`${role}_inv`} stroke={chartColors[role]} strokeWidth={2} dot={false} name={`${ROLE_LABELS[role]} Inv`} />
                    ))}
                    {SUPPLY_CHAIN_ORDER.map(role => (
                      <Line key={`${role}_back`} type="monotone" dataKey={`${role}_back`} stroke={chartColors[role]} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name={`${ROLE_LABELS[role]} -Backlog`} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Variance + Cost Comparison */}
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Variance & Cost Comparison
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={highVarVarianceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                    <XAxis dataKey="role" stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <YAxis stroke="hsl(215, 20%, 65%)" tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'hsl(210, 40%, 98%)' }} />
                    <Legend />
                    <Bar dataKey="variance" fill="hsl(0, 84%, 60%)" name="Order Variance" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" fill="hsl(262, 83%, 68%)" name="Total Cost ($)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {highVarVarianceData.map((d, i) => (
                  <div key={d.role} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="font-medium text-sm text-foreground">{d.role}</span>
                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Variance: <span className="text-primary font-bold">{d.variance.toFixed(1)}</span></p>
                      <p className="text-muted-foreground">Cost: <span className="text-destructive font-bold">${d.cost.toFixed(2)}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Insight */}
          <div className="glass-card rounded-xl p-4 border-l-4 border-destructive">
            <p className="text-sm text-muted-foreground">
              <span className="text-destructive font-semibold">Key Insight:</span> Longer delays + bigger demand spike = 
              wholesaler and distributor experience the <span className="text-destructive font-medium">worst cost-to-variance ratio</span>. 
              They over-order to cover backlogs, causing massive inventory oscillations. 
              The "middle" of the supply chain often suffers the most.
            </p>
          </div>
        </section>

        {/* Discussion Questions */}
        <section className="glass-card rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            Discussion Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              'Why does order variance increase upstream even when customer demand is stable?',
              'How do longer delays amplify the bullwhip effect?',
              'What strategies could the wholesaler use to reduce its cost?',
              'Would sharing demand information across the chain reduce the bullwhip effect?',
              'How does the AI ordering policy (target inventory = 12) contribute to oscillations?',
              'In real supply chains, what role does forecasting play in this phenomenon?',
            ].map((q, i) => (
              <div key={i} className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground">
                <span className="text-primary font-bold mr-2">{i + 1}.</span>
                {q}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
