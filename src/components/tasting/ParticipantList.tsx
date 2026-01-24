interface ParticipantDisplay {
  id: string;
  displayName: string;
  status: string;
  isReady: boolean;
  currentWhiskeyIndex?: number;
}

interface ParticipantListProps {
  participants: ParticipantDisplay[];
  currentParticipantId?: string;
  showStatus?: boolean;
}

export function ParticipantList({
  participants,
  currentParticipantId,
  showStatus = true,
}: ParticipantListProps) {
  const getStatusIndicator = (participant: ParticipantDisplay) => {
    if (participant.status === 'completed') {
      return (
        <span className="flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
      );
    }
    if (participant.isReady) {
      return (
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
      );
    }
    return (
      <span className="flex h-2 w-2">
        <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500" />
      </span>
    );
  };

  const getStatusText = (participant: ParticipantDisplay) => {
    if (participant.status === 'completed') return 'Done';
    if (participant.status === 'tasting') return 'Tasting';
    if (participant.isReady) return 'Ready';
    return 'Waiting';
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Participants ({participants.length})
      </h3>
      <ul className="space-y-1">
        {participants.map((participant) => (
          <li
            key={participant.id}
            className={`
              flex items-center justify-between px-3 py-2 rounded-lg
              ${participant.id === currentParticipantId
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-zinc-800/50'
              }
            `}
          >
            <div className="flex items-center gap-3">
              {showStatus && (
                <div className="relative">
                  {getStatusIndicator(participant)}
                </div>
              )}
              <span className={`
                text-sm
                ${participant.id === currentParticipantId
                  ? 'text-amber-500 font-medium'
                  : 'text-zinc-300'
                }
              `}>
                {participant.displayName}
                {participant.id === currentParticipantId && ' (You)'}
              </span>
            </div>
            {showStatus && (
              <span className="text-xs text-zinc-500">
                {getStatusText(participant)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
