import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardContent } from '@/components/ui';
import {
  PhaseDisplay,
  ScoreForm,
  FlightProgress,
  ParticipantList,
} from '@/components/tasting';
import { useSessionStore } from '@/store/sessionStore';
import { getNextPhase } from '@/utils/timer';
import type { TastingPhase, ScoreInput } from '@/types';

export function TastingSessionPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    session,
    whiskeys,
    participants,
    currentParticipant,
    isModerator,
    isLoading,
    participantToken,
    fetchSession,
    advancePhase,
    revealResults,
    submitScore,
    connectToSession,
  } = useSessionStore();

  const [completedWhiskeys, setCompletedWhiskeys] = useState<number[]>([]);

  // Fetch session on mount
  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
    }
  }, [sessionId, fetchSession]);

  // Connect to WebSocket
  useEffect(() => {
    if (participantToken && sessionId) {
      connectToSession(participantToken, isModerator ? sessionId : undefined);
    }
  }, [participantToken, sessionId, isModerator, connectToSession]);

  // Redirect to reveal when status changes
  useEffect(() => {
    if (session?.status === 'reveal') {
      navigate(`/session/${sessionId}/reveal`);
    }
  }, [session?.status, sessionId, navigate]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading session...</p>
      </div>
    );
  }

  const currentPhase = session.currentPhase as TastingPhase;
  const currentWhiskey = whiskeys[session.currentWhiskeyIndex];
  const isLastWhiskey = session.currentWhiskeyIndex === whiskeys.length - 1;

  const handlePhaseComplete = () => {
    const nextPhase = getNextPhase(currentPhase);
    if (nextPhase && sessionId) {
      advancePhase(sessionId, nextPhase);
    }
  };

  const handleAdvancePhase = async () => {
    const nextPhase = getNextPhase(currentPhase);
    if (nextPhase && sessionId) {
      await advancePhase(sessionId, nextPhase);
    } else if (!isLastWhiskey && sessionId) {
      setCompletedWhiskeys([...completedWhiskeys, session.currentWhiskeyIndex]);
      await advancePhase(sessionId, 'pour' as TastingPhase, session.currentWhiskeyIndex + 1);
    }
  };

  const handleScoreSubmit = async (scoreInput: ScoreInput) => {
    if (!currentWhiskey) return;

    try {
      await submitScore({
        whiskeyId: currentWhiskey.id,
        nose: scoreInput.nose,
        palate: scoreInput.palate,
        finish: scoreInput.finish,
        overall: scoreInput.overall,
        noseNotes: scoreInput.noseNotes,
        palateNotes: scoreInput.palateNotes,
        finishNotes: scoreInput.finishNotes,
        generalNotes: scoreInput.generalNotes,
        identityGuess: scoreInput.identityGuess,
      });

      if (isLastWhiskey) {
        setCompletedWhiskeys([...completedWhiskeys, session.currentWhiskeyIndex]);
      } else if (sessionId) {
        await advancePhase(sessionId, 'palate-reset' as TastingPhase);
      }
    } catch {
      // Error handled in store
    }
  };

  const handleNextWhiskey = async () => {
    if (!isLastWhiskey && sessionId) {
      setCompletedWhiskeys([...completedWhiskeys, session.currentWhiskeyIndex]);
      await advancePhase(sessionId, 'pour' as TastingPhase, session.currentWhiskeyIndex + 1);
    }
  };

  const handleInitiateReveal = async () => {
    if (sessionId) {
      await revealResults(sessionId);
      navigate(`/session/${sessionId}/reveal`);
    }
  };

  const allScoresLocked = completedWhiskeys.length === whiskeys.length;

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">{session.name}</h1>
            <p className="text-sm text-zinc-400 capitalize">{session.theme.replace('-', ' ')}</p>
          </div>
          {isModerator && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/session/${sessionId}/lobby`)}
              >
                Pause
              </Button>
            </div>
          )}
        </div>

        {/* Flight Progress */}
        <div className="mb-8">
          <FlightProgress
            totalWhiskeys={whiskeys.length}
            currentIndex={session.currentWhiskeyIndex}
            completedIndices={completedWhiskeys}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Tasting Area */}
          <div className="lg:col-span-2">
            <Card variant="elevated" className="min-h-[600px]">
              <CardContent className="py-8">
                {allScoresLocked ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-zinc-100 mb-2">
                      All Scores Locked!
                    </h2>
                    <p className="text-zinc-400 mb-6">
                      {isModerator
                        ? 'All participants have completed their tastings. Ready to reveal!'
                        : 'Waiting for the host to reveal the results...'}
                    </p>
                    {isModerator && (
                      <Button variant="primary" size="lg" onClick={handleInitiateReveal} isLoading={isLoading}>
                        Reveal Results
                      </Button>
                    )}
                  </div>
                ) : currentPhase === 'scoring' ? (
                  <ScoreForm
                    whiskeyNumber={session.currentWhiskeyIndex + 1}
                    onSubmit={handleScoreSubmit}
                  />
                ) : (
                  <PhaseDisplay
                    phase={currentPhase}
                    whiskeyNumber={session.currentWhiskeyIndex + 1}
                    onPhaseComplete={handlePhaseComplete}
                  >
                    {currentPhase === 'pour' && (
                      <Button variant="primary" onClick={handleAdvancePhase}>
                        I've Poured - Start Nosing
                      </Button>
                    )}
                    {currentPhase === 'tasting-neat' && (
                      <Button variant="primary" onClick={handleAdvancePhase}>
                        Ready for Water Tasting
                      </Button>
                    )}
                    {currentPhase === 'tasting-water' && (
                      <Button variant="primary" onClick={handleAdvancePhase}>
                        Ready to Score
                      </Button>
                    )}
                    {currentPhase === 'palate-reset' && (
                      <Button
                        variant="primary"
                        onClick={handleNextWhiskey}
                        className="mt-4"
                      >
                        Ready for Next Whiskey
                      </Button>
                    )}
                  </PhaseDisplay>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {currentWhiskey && !allScoresLocked && (
              <Card>
                <CardContent>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Current Sample
                  </h3>
                  <div className="text-center py-4 bg-zinc-900 rounded-lg">
                    <span className="text-4xl font-bold text-amber-500">
                      #{currentWhiskey.displayNumber}
                    </span>
                    <p className="text-sm text-zinc-400 mt-2">
                      Pour: {currentWhiskey.pourSize}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <ParticipantList
                  participants={participants}
                  currentParticipantId={currentParticipant?.id}
                />
              </CardContent>
            </Card>

            {isModerator && (
              <Card>
                <CardContent>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Host Controls
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={handleAdvancePhase}
                    >
                      Advance Phase
                    </Button>
                    {!isLastWhiskey && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={handleNextWhiskey}
                      >
                        Skip to Next Whiskey
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      onClick={handleInitiateReveal}
                    >
                      Reveal Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
