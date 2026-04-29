import { WeeklyRecord, Role, ROLE_LABELS } from '@/types/game';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface GameChartsProps {
  history: Record<Role, WeeklyRecord[]>;
  playerRole: Role;
  showAllRoles?: boolean;
}

export function GameCharts({ history, playerRole, showAllRoles = false }: GameChartsProps) {
  const playerHistory = history[playerRole] || [];
  
  if (playerHistory.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">
        <p>Charts will appear after the first week</p>
      </div>
    );
  }

  // Transform data for combined chart if showing all roles
  const combinedData = playerHistory.map((record, index) => {
    const dataPoint: Record<string, number> = { week: record.week };
    if (showAllRoles) {
      (['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).forEach((role) => {
        dataPoint[`${role}_inventory`] = history[role]?.[index]?.inventory || 0;
        dataPoint[`${role}_backlog`] = history[role]?.[index]?.backlog || 0;
      });
    } else {
      dataPoint.inventory = record.inventory;
      dataPoint.backlog = record.backlog;
      dataPoint.orders = record.orderPlaced;
    }
    return dataPoint;
  });

  const chartColors = {
    retailer: 'hsl(43, 96%, 56%)',
    wholesaler: 'hsl(174, 72%, 46%)',
    distributor: 'hsl(262, 83%, 68%)',
    factory: 'hsl(142, 76%, 46%)',
  };

  return (
    <div className="space-y-6">
      {/* Player's Performance Chart */}
      {!showAllRoles && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Your Performance ({ROLE_LABELS[playerRole]})
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                <XAxis 
                  dataKey="week" 
                  stroke="hsl(215, 20%, 65%)" 
                  tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(215, 20%, 65%)" 
                  tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 14%)',
                    border: '1px solid hsl(217, 33%, 25%)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="inventory"
                  stroke="hsl(174, 72%, 46%)"
                  strokeWidth={2}
                  dot={false}
                  name="Inventory"
                />
                <Line
                  type="monotone"
                  dataKey="backlog"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={2}
                  dot={false}
                  name="Backlog"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(43, 96%, 56%)"
                  strokeWidth={2}
                  dot={false}
                  name="Orders Placed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* All Roles Inventory Comparison */}
      {showAllRoles && (
        <>
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Inventory Levels (All Stages)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis 
                    dataKey="week" 
                    stroke="hsl(215, 20%, 65%)" 
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="hsl(215, 20%, 65%)" 
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222, 47%, 14%)',
                      border: '1px solid hsl(217, 33%, 25%)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
                  />
                  <Legend />
                  {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map((role) => (
                    <Line
                      key={role}
                      type="monotone"
                      dataKey={`${role}_inventory`}
                      stroke={chartColors[role]}
                      strokeWidth={2}
                      dot={false}
                      name={ROLE_LABELS[role]}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Backlog Levels (All Stages)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 25%)" />
                  <XAxis 
                    dataKey="week" 
                    stroke="hsl(215, 20%, 65%)" 
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="hsl(215, 20%, 65%)" 
                    tick={{ fill: 'hsl(215, 20%, 65%)', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222, 47%, 14%)',
                      border: '1px solid hsl(217, 33%, 25%)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
                  />
                  <Legend />
                  {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map((role) => (
                    <Line
                      key={role}
                      type="monotone"
                      dataKey={`${role}_backlog`}
                      stroke={chartColors[role]}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name={`${ROLE_LABELS[role]} Backlog`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
