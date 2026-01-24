import { Card, CardContent } from '@/components/ui';
import { getScoreDescriptor } from '@/utils/scoring';

interface TastingNoteCardProps {
  note: {
    id: string;
    whiskey: {
      id: string;
      name: string;
      distillery: string;
      age?: number;
      proof: number;
    };
    session: {
      id: string;
      name: string;
    };
    scores: {
      nose: number;
      palate: number;
      finish: number;
      overall: number;
      total: number;
    };
    notes: {
      nose?: string;
      palate?: string;
      finish?: string;
      general?: string;
    };
    identityGuess?: string;
    lockedAt: Date | string;
  };
  showShareButton?: boolean;
  isPublic?: boolean;
  onToggleShare?: (isPublic: boolean) => void;
}

export function TastingNoteCard({ note, showShareButton, isPublic, onToggleShare }: TastingNoteCardProps) {
  const lockedDate = new Date(note.lockedAt);

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardContent>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{note.whiskey.name}</h3>
            <p className="text-sm text-zinc-400">{note.whiskey.distillery}</p>
            <div className="flex gap-3 mt-1 text-xs text-zinc-500">
              {note.whiskey.age && <span>{note.whiskey.age} years</span>}
              <span>{note.whiskey.proof} proof</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-500">
              {note.scores.total.toFixed(1)}
            </div>
            <div className="text-xs text-zinc-500">
              {getScoreDescriptor(note.scores.total)}
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-4 gap-2 p-3 bg-zinc-800/50 rounded-lg mb-4">
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Nose</div>
            <div className="text-lg font-medium text-zinc-300">{note.scores.nose}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Palate</div>
            <div className="text-lg font-medium text-zinc-300">{note.scores.palate}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Finish</div>
            <div className="text-lg font-medium text-zinc-300">{note.scores.finish}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500 uppercase">Overall</div>
            <div className="text-lg font-medium text-zinc-300">{note.scores.overall}</div>
          </div>
        </div>

        {/* Tasting Notes */}
        {(note.notes.nose || note.notes.palate || note.notes.finish || note.notes.general) && (
          <div className="space-y-3 mb-4">
            {note.notes.nose && (
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-1">Nose Notes</div>
                <p className="text-sm text-zinc-300">{note.notes.nose}</p>
              </div>
            )}
            {note.notes.palate && (
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-1">Palate Notes</div>
                <p className="text-sm text-zinc-300">{note.notes.palate}</p>
              </div>
            )}
            {note.notes.finish && (
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-1">Finish Notes</div>
                <p className="text-sm text-zinc-300">{note.notes.finish}</p>
              </div>
            )}
            {note.notes.general && (
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-1">General Notes</div>
                <p className="text-sm text-zinc-300">{note.notes.general}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-700">
          <div className="text-xs text-zinc-500">
            <span>From: {note.session.name}</span>
            <span className="mx-2">|</span>
            <span>{lockedDate.toLocaleDateString()}</span>
          </div>
          {showShareButton && onToggleShare && (
            <button
              onClick={() => onToggleShare(!isPublic)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                isPublic
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
              }`}
            >
              {isPublic ? 'Shared' : 'Share to Profile'}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
