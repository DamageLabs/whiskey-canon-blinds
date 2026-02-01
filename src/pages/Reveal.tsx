import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardContent } from '@/components/ui';
import { CommentList } from '@/components/comments';
import { useSessionStore } from '@/store/sessionStore';
import { useAuthStore } from '@/store/authStore';
import { socialApi, resultsExportApi, sessionsApi } from '@/services/api';
import { getScoreDescriptor } from '@/utils/scoring';

export function RevealPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, results, isLoading, fetchSession, fetchResults, isModerator } = useSessionStore();
  const { user, isAuthenticated } = useAuthStore();

  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [sharedScores, setSharedScores] = useState<Set<string>>(new Set());
  const [sharingScoreId, setSharingScoreId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch session and results on mount
  useEffect(() => {
    if (sessionId) {
      fetchSession(sessionId);
      fetchResults(sessionId).catch(() => {
        // Results might not be available yet
      });
    }
  }, [sessionId, fetchSession, fetchResults]);

  // Auto-reveal all results for non-moderators
  useEffect(() => {
    if (!isModerator && results?.results && results.results.length > 0 && revealedCount === 0) {
      setRevealedCount(results.results.length);
    }
  }, [isModerator, results, revealedCount]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Loading results...</p>
      </div>
    );
  }

  const whiskeyResults = results?.results || [];
  const totalWhiskeys = whiskeyResults.length;

  const handleRevealAll = () => {
    setIsRevealing(true);
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setRevealedCount(count);
      if (count >= totalWhiskeys) {
        clearInterval(interval);
        setIsRevealing(false);
      }
    }, 1000);
  };

  const handleRevealNext = () => {
    if (revealedCount < totalWhiskeys) {
      setRevealedCount(revealedCount + 1);
    }
  };

  const winner = whiskeyResults[0];

  const toggleComments = (whiskeyId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(whiskeyId)) {
        next.delete(whiskeyId);
      } else {
        next.add(whiskeyId);
      }
      return next;
    });
  };

  const handleDuplicate = async () => {
    if (!sessionId || isDuplicating) return;
    setIsDuplicating(true);
    try {
      const result = await sessionsApi.duplicate(sessionId);
      navigate(`/session/${result.id}/setup`);
    } catch (err) {
      console.error('Failed to duplicate session:', err);
      alert('Failed to duplicate session. Please try again.');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !inviteEmail || isSendingInvite) return;
    setIsSendingInvite(true);
    setInviteStatus(null);
    try {
      await sessionsApi.sendInvite(sessionId, inviteEmail);
      setInviteStatus({ type: 'success', message: 'Invite sent successfully!' });
      setInviteEmail('');
    } catch (err) {
      console.error('Failed to send invite:', err);
      setInviteStatus({ type: 'error', message: 'Failed to send invite. Please try again.' });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleExportPdf = async () => {
    if (!sessionId || !session || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await sessionsApi.exportPdf(sessionId, session.name);
      setShowExportMenu(false);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">The Reveal</h1>
          <p className="text-zinc-400">{session.name}</p>
        </div>

        {/* Reveal Controls */}
        {revealedCount < totalWhiskeys && totalWhiskeys > 0 && (
          <div className="flex justify-center gap-4 mb-8">
            {isModerator && (
              <>
                <Button variant="primary" onClick={handleRevealNext}>
                  Reveal #{revealedCount + 1}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRevealAll}
                  disabled={isRevealing}
                >
                  Reveal All
                </Button>
              </>
            )}
          </div>
        )}

        {/* Winner Banner */}
        {revealedCount === totalWhiskeys && winner && (
          <Card variant="elevated" className="mb-8 border border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-transparent">
            <CardContent className="text-center py-8">
              <div className="text-amber-500 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-1">Winner</h2>
              <p className="text-3xl font-bold text-amber-500 mb-2">{winner.whiskey.name}</p>
              <p className="text-zinc-400">{winner.whiskey.distillery}</p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-full">
                <span className="text-2xl font-bold text-amber-500">{winner.averageScore.toFixed(1)}</span>
                <span className="text-zinc-400">/ 10</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Grid */}
        <div className="space-y-4">
          {whiskeyResults.map((result, index) => {
            const isRevealed = index < revealedCount;

            return (
              <Card
                key={result.whiskey.id}
                variant={isRevealed ? 'elevated' : 'outlined'}
                className={`transition-all duration-500 ${
                  isRevealed ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <CardContent>
                  <div className="flex items-start gap-6">
                    {/* Number Badge */}
                    <div className="flex-shrink-0">
                      <div className={`
                        w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold
                        ${isRevealed
                          ? result.ranking === 1
                            ? 'bg-amber-500 text-zinc-900'
                            : result.ranking === 2
                            ? 'bg-zinc-400 text-zinc-900'
                            : result.ranking === 3
                            ? 'bg-amber-700 text-zinc-100'
                            : 'bg-zinc-700 text-zinc-300'
                          : 'bg-zinc-800 text-zinc-500'
                        }
                      `}>
                        {isRevealed ? `#${result.ranking}` : `?`}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      {isRevealed ? (
                        <>
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-bold text-zinc-100">
                                {result.whiskey.name}
                              </h3>
                              <p className="text-zinc-400">{result.whiskey.distillery}</p>
                              <div className="flex gap-4 mt-2 text-sm text-zinc-500">
                                {result.whiskey.age && (
                                  <span>{result.whiskey.age} years</span>
                                )}
                                <span>{result.whiskey.proof} proof</span>
                                {result.whiskey.price && (
                                  <span>${result.whiskey.price}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold text-amber-500">
                                {result.averageScore.toFixed(1)}
                              </div>
                              <div className="text-sm text-zinc-500">
                                {getScoreDescriptor(result.averageScore)}
                              </div>
                            </div>
                          </div>

                          {/* Category Breakdown */}
                          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-700">
                            <div>
                              <div className="text-xs text-zinc-500 uppercase">Nose</div>
                              <div className="text-lg font-medium text-zinc-300">
                                {result.categoryAverages.nose.toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-zinc-500 uppercase">Palate</div>
                              <div className="text-lg font-medium text-zinc-300">
                                {result.categoryAverages.palate.toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-zinc-500 uppercase">Finish</div>
                              <div className="text-lg font-medium text-zinc-300">
                                {result.categoryAverages.finish.toFixed(1)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-zinc-500 uppercase">Overall</div>
                              <div className="text-lg font-medium text-zinc-300">
                                {result.categoryAverages.overall.toFixed(1)}
                              </div>
                            </div>
                          </div>

                          {/* Share Your Score Button */}
                          {isAuthenticated && user && result.scores && (() => {
                            const myScore = result.scores.find(
                              (s: { participantName?: string }) => s.participantName === user.displayName
                            ) as { id: string } | undefined;
                            if (!myScore) return null;
                            const isShared = sharedScores.has(myScore.id);
                            const isSharing = sharingScoreId === myScore.id;
                            return (
                              <div className="mt-4 pt-4 border-t border-zinc-700 flex items-center gap-3">
                                <button
                                  onClick={async () => {
                                    if (isSharing) return;
                                    setSharingScoreId(myScore.id);
                                    try {
                                      await socialApi.toggleScoreVisibility(myScore.id, !isShared);
                                      if (isShared) {
                                        setSharedScores(prev => {
                                          const next = new Set(prev);
                                          next.delete(myScore.id);
                                          return next;
                                        });
                                      } else {
                                        setSharedScores(prev => new Set(prev).add(myScore.id));
                                      }
                                    } catch (err) {
                                      console.error('Failed to share score:', err);
                                    } finally {
                                      setSharingScoreId(null);
                                    }
                                  }}
                                  disabled={isSharing}
                                  className={`text-sm px-4 py-2 rounded-lg transition-colors ${
                                    isShared
                                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                  }`}
                                >
                                  {isSharing
                                    ? 'Saving...'
                                    : isShared
                                    ? 'Shared to Profile'
                                    : 'Share My Score to Profile'}
                                </button>
                              </div>
                            );
                          })()}

                          {/* Comments Section Toggle */}
                          <div className="mt-4 pt-4 border-t border-zinc-700">
                            <button
                              onClick={() => toggleComments(result.whiskey.id)}
                              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {expandedComments.has(result.whiskey.id) ? 'Hide Discussion' : 'Join Discussion'}
                            </button>

                            {expandedComments.has(result.whiskey.id) && sessionId && (
                              <div className="mt-4">
                                <CommentList
                                  sessionId={sessionId}
                                  whiskeyId={result.whiskey.id}
                                  whiskeyName={result.whiskey.name}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-4">
                          <div className="text-xl font-medium text-zinc-500">
                            Whiskey #{result.whiskey.displayNumber}
                          </div>
                          <p className="text-zinc-600 mt-1">Not yet revealed</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Loading State */}
        {isLoading && whiskeyResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-400">Loading results...</p>
          </div>
        )}

        {/* No Results */}
        {!isLoading && whiskeyResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-400">No results available yet.</p>
            <p className="text-zinc-500 text-sm mt-2">
              Results will appear after the reveal is initiated.
            </p>
          </div>
        )}

        {/* Actions */}
        {revealedCount === totalWhiskeys && totalWhiskeys > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/')}>
              Back to Home
            </Button>

            {/* Moderator Actions */}
            {isModerator && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                >
                  {isDuplicating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Duplicating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Duplicate Session
                    </>
                  )}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setShowInviteModal(true)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Invite via Email
                </Button>
              </>
            )}

            <div className="relative" ref={exportMenuRef}>
              <Button
                variant="primary"
                onClick={() => setShowExportMenu(!showExportMenu)}
              >
                Export Results
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
              {showExportMenu && results && (
                <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-10">
                  <button
                    onClick={() => {
                      resultsExportApi.downloadCSV(results);
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-zinc-200 hover:bg-zinc-700 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download CSV
                  </button>
                  <button
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="w-full px-4 py-3 text-left text-zinc-200 hover:bg-zinc-700 flex items-center gap-3 border-t border-zinc-700 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    {isExportingPdf ? 'Generating...' : 'Download PDF'}
                  </button>
                  <button
                    onClick={() => {
                      resultsExportApi.downloadPDF(results);
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left text-zinc-200 hover:bg-zinc-700 flex items-center gap-3 border-t border-zinc-700"
                  >
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print / Save PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-800 rounded-xl max-w-md w-full p-6 border border-zinc-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Invite via Email</h3>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteStatus(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-zinc-400 text-sm mb-4">
                Send an email invitation with the session details and join link.
              </p>

              <form onSubmit={handleSendInvite}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
                  required
                />

                {inviteStatus && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${
                    inviteStatus.type === 'success'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {inviteStatus.message}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteStatus(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSendingInvite || !inviteEmail}
                    className="flex-1"
                  >
                    {isSendingInvite ? 'Sending...' : 'Send Invite'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
