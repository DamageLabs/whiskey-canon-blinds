import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface CategoryRadarProps {
  data: {
    nose: number;
    palate: number;
    finish: number;
    overall: number;
  };
  maxValue?: number;
}

export function CategoryRadar({ data, maxValue = 10 }: CategoryRadarProps) {
  const chartData = [
    { category: 'Nose', value: data.nose, fullMark: maxValue },
    { category: 'Palate', value: data.palate, fullMark: maxValue },
    { category: 'Finish', value: data.finish, fullMark: maxValue },
    { category: 'Overall', value: data.overall, fullMark: maxValue },
  ];

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: { category: string; value: number } }>;
  }) => {
    if (active && payload && payload.length) {
      const { category, value } = payload[0].payload;
      return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 shadow-lg">
          <p className="text-zinc-300 text-sm">
            {category}: <span className="text-amber-500 font-medium">{value.toFixed(2)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: '#a1a1aa', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={45}
          domain={[0, maxValue]}
          tick={{ fill: '#71717a', fontSize: 10 }}
          tickCount={6}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#d97706"
          fill="#d97706"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
