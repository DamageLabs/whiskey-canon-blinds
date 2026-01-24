import { getScoreDescriptor } from '@/utils/scoring';

interface ScoreSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function ScoreSlider({ label, value, onChange, disabled = false }: ScoreSliderProps) {
  const descriptor = getScoreDescriptor(value);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-amber-500">{value}</span>
          <span className="text-xs text-zinc-500">/ 10</span>
        </div>
      </div>

      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-amber-500
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-lg
          disabled:opacity-50 disabled:cursor-not-allowed"
      />

      <div className="flex justify-between mt-1">
        <span className="text-xs text-zinc-500">1</span>
        <span className="text-xs text-zinc-400">{descriptor}</span>
        <span className="text-xs text-zinc-500">10</span>
      </div>
    </div>
  );
}
