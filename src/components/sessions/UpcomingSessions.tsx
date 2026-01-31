import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { upcomingSessionsApi, type UpcomingSession } from '@/services/api';
import { Card, CardContent } from '@/components/ui';

export function UpcomingSessions() {
  const [sessions, setSessions] = useState<UpcomingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setIsLoading(true);
        const data = await upcomingSessionsApi.get();
        setSessions(data);
        setError(null);
      } catch (err) {
        setError('Failed to load upcoming sessions');
        console.error('Failed to fetch upcoming sessions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffHours < 1) return 'Starting soon';
    if (diffHours < 24) return `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-zinc-100">Upcoming Sessions</h3>
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-zinc-100">Upcoming Sessions</h3>
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null; // Don't show section if no upcoming sessions
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-zinc-100">Upcoming Sessions</h3>
      <div className="grid gap-3">
        {sessions.map((session) => (
          <Link key={session.id} to={`/session/${session.id}/lobby`}>
            <Card
              variant="outlined"
              className="hover:border-amber-500/50 transition-colors"
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-zinc-100">{session.name}</h4>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="text-zinc-500">
                        {session.theme}
                        {session.customTheme && ` (${session.customTheme})`}
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-500">
                        {session.participantCount} participant{session.participantCount !== 1 ? 's' : ''}
                      </span>
                      {session.isModerator && (
                        <>
                          <span className="text-zinc-600">•</span>
                          <span className="text-amber-500 text-xs">Moderator</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-amber-500 font-medium">
                      {formatDate(session.scheduledAt)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Code: {session.inviteCode}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
