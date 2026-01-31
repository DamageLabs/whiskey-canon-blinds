import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { AnalyticsDistribution } from '@/services/api';

interface ScoreDistributionProps {
  data: AnalyticsDistribution;
}

export function ScoreDistribution({ data }: ScoreDistributionProps) {
  const chartData = Object.entries(data.distribution).map(([range, count]) => ({
    range,
    count,
    // Color based on score range (amber gradient)
    color: getColorForRange(range),
  }));

  function getColorForRange(range: string): string {
    const start = parseInt(range.split('-')[0], 10);
    // Gradient from red (low) to green (high)
    if (start >= 8) return '#22c55e'; // green
    if (start >= 6) return '#84cc16'; // lime
    if (start >= 4) return '#d97706'; // amber
    if (start >= 2) return '#f97316'; // orange
    return '#ef4444'; // red
  }

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
          <p className="text-zinc-300 text-sm">Score Range: {label}</p>
          <p className="text-amber-500 font-medium">{payload[0].value} whiskeys</p>
        </div>
      );
    }
    return null;
  };

  if (data.total === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-zinc-500">
        No score data available
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
          <XAxis
            dataKey="range"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-4 text-sm text-zinc-400">
        <div>
          Total: <span className="text-zinc-200 font-medium">{data.total}</span> whiskeys
        </div>
        <div>
          Average: <span className="text-amber-500 font-medium">{data.average.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
