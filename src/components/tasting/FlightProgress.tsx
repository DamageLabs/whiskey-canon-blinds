interface FlightProgressProps {
  totalWhiskeys: number;
  currentIndex: number;
  completedIndices?: number[];
}

export function FlightProgress({
  totalWhiskeys,
  currentIndex,
  completedIndices = [],
}: FlightProgressProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-zinc-400">Flight Progress</span>
        <span className="text-sm text-zinc-300">
          {currentIndex + 1} of {totalWhiskeys}
        </span>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: totalWhiskeys }, (_, index) => {
          const isCompleted = completedIndices.includes(index);
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex && !isCompleted;

          return (
            <div
              key={index}
              className={`
                flex-1 h-2 rounded-full transition-all
                ${isCompleted ? 'bg-green-500' : ''}
                ${isCurrent ? 'bg-amber-500 animate-pulse' : ''}
                ${isPending ? 'bg-zinc-700' : ''}
              `}
              title={`Whiskey #${index + 1}`}
            />
          );
        })}
      </div>

      {/* Whiskey numbers */}
      <div className="flex gap-2 mt-1">
        {Array.from({ length: totalWhiskeys }, (_, index) => (
          <div
            key={index}
            className={`
              flex-1 text-center text-xs
              ${index === currentIndex ? 'text-amber-500 font-medium' : 'text-zinc-500'}
            `}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
