import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import { ParticipantList } from '@/components/tasting';
import { useSessionStore } from '@/store/sessionStore';

function formatInviteCode(code: string): string {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function createInviteUrl(code: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join/${code}`;
}

export function SessionLobbyPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    session,
    whiskeys,
    participants,
    currentParticipant,
    isModerator,
    participantToken,
    isLoading,
    error,
    fetchSession,
    startSession,
    markReady,
    connectToSession,
  } = useSessionStore();

  const [copied, setCopied] = useState(false);

  // Fetch session data on mount
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

  // Redirect to tasting when session starts
  useEffect(() => {
    if (session?.status === 'active') {
      navigate(`/session/${sessionId}/tasting`);
    }
  }, [session?.status, sessionId, navigate]);

  if (isLoading && !session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Session not found</p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const inviteUrl = createInviteUrl(session.inviteCode);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(session.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = session.inviteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleStartSession = async () => {
    try {
      await startSession(session.id);
      navigate(`/session/${sessionId}/tasting`);
    } catch {
      // Error handled in store
    }
  };

  const handleReady = async () => {
    try {
      await markReady();
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">{session.name}</h1>
          <p className="text-zinc-400 mt-1">
            {isModerator ? 'Waiting for participants...' : 'Waiting for host to start...'}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Invite Card (Moderator Only) */}
            {isModerator && (
              <Card variant="elevated">
                <CardHeader
                  title="Invite Participants"
                  description="Share the code or link with your guests"
                />
                <CardContent className="space-y-4">
                  {/* Invite Code */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Session Code</label>
                    <div className="flex gap-2">
                      <div className="flex-1 px-4 py-3 bg-zinc-900 rounded-lg text-2xl font-mono tracking-[0.3em] text-center text-amber-500">
                        {formatInviteCode(session.inviteCode)}
                      </div>
                      <Button
                        variant="secondary"
                        onClick={handleCopyCode}
                        className="px-4"
                      >
                        {copied ? (
                          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Share Link */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Share Link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-400 truncate"
                      />
                      <Button variant="secondary" onClick={handleCopyLink}>
                        Copy
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Session Info */}
            <Card>
              <CardHeader title="Session Info" />
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">Theme</dt>
                    <dd className="text-zinc-100 capitalize">{session.theme.replace('-', ' ')}</dd>
                  </div>
                  {session.proofMin && session.proofMax && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-400">Proof Range</dt>
                      <dd className="text-zinc-100">
                        {session.proofMin} - {session.proofMax}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">Flight Size</dt>
                    <dd className="text-zinc-100">{whiskeys.length} whiskeys</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Participants */}
            <Card variant="elevated">
              <CardContent>
                <ParticipantList
                  participants={participants}
                  currentParticipantId={currentParticipant?.id}
                />

                {participants.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-zinc-400">Waiting for participants...</p>
                    <p className="text-sm text-zinc-500 mt-1">Share the code to invite guests</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              {isModerator ? (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleStartSession}
                  disabled={participants.length === 0}
                  isLoading={isLoading}
                >
                  Start Tasting Session
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleReady}
                  disabled={currentParticipant?.isReady}
                  isLoading={isLoading}
                >
                  {currentParticipant?.isReady ? "You're Ready!" : "I'm Ready"}
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate('/')}
              >
                Leave Session
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
