import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { AnalyticsTrend } from '@/services/api';

interface TrendChartProps {
  data: AnalyticsTrend[];
  showCategories?: boolean;
}

export function TrendChart({ data, showCategories = false }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500">
        No trend data available
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
          <p className="text-zinc-300 text-sm mb-2">{formatDate(label || '')}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#71717a"
          tick={{ fill: '#71717a', fontSize: 12 }}
        />
        <YAxis
          domain={[0, 10]}
          stroke="#71717a"
          tick={{ fill: '#71717a', fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          formatter={(value) => <span className="text-zinc-300">{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="averageScore"
          name="Total Score"
          stroke="#d97706"
          strokeWidth={2}
          dot={{ fill: '#d97706', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
        {showCategories && (
          <>
            <Line
              type="monotone"
              dataKey="averageNose"
              name="Nose"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="averagePalate"
              name="Palate"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="averageFinish"
              name="Finish"
              stroke="#a855f7"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="averageOverall"
              name="Overall"
              stroke="#f43f5e"
              strokeWidth={1.5}
              dot={false}
            />
          </>
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
