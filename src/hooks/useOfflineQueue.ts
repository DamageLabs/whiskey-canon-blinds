import { useState, useEffect, useCallback } from 'react';
import { offlineStorage } from '@/services/offlineStorage';
import { scoresApi, type ScoreData } from '@/services/api';
import { useOfflineStatus } from './useOfflineStatus';

export function useOfflineQueue() {
  const { isOnline, wasOffline, clearWasOffline } = useOfflineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Update queue count
  const refreshQueueCount = useCallback(async () => {
    try {
      const count = await offlineStorage.getQueueCount();
      setQueueCount(count);
    } catch (error) {
      console.error('Failed to get queue count:', error);
    }
  }, []);

  // Queue a score when offline
  const queueScore = useCallback(async (score: Omit<ScoreData, 'sessionId'> & { sessionId: string }) => {
    try {
      await offlineStorage.queueScore(score);
      await refreshQueueCount();
    } catch (error) {
      console.error('Failed to queue score:', error);
      throw error;
    }
  }, [refreshQueueCount]);

  // Sync queued scores when back online
  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const queuedScores = await offlineStorage.getQueuedScores();

      if (queuedScores.length === 0) {
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const queuedScore of queuedScores) {
        try {
          await scoresApi.submit({
            sessionId: queuedScore.sessionId,
            whiskeyId: queuedScore.whiskeyId,
            nose: queuedScore.nose,
            palate: queuedScore.palate,
            finish: queuedScore.finish,
            overall: queuedScore.overall,
            noseNotes: queuedScore.noseNotes,
            palateNotes: queuedScore.palateNotes,
            finishNotes: queuedScore.finishNotes,
            generalNotes: queuedScore.generalNotes,
            identityGuess: queuedScore.identityGuess,
          });

          await offlineStorage.removeQueuedScore(queuedScore.id);
          successCount++;
        } catch (error) {
          console.error('Failed to sync score:', error);
          failCount++;
        }
      }

      await refreshQueueCount();

      if (failCount > 0) {
        setSyncError(`${failCount} score(s) failed to sync. Will retry later.`);
      }

      clearWasOffline();
    } catch (error) {
      console.error('Failed to sync queue:', error);
      setSyncError('Failed to sync offline scores');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshQueueCount, clearWasOffline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && queueCount > 0) {
      syncQueue();
    }
  }, [isOnline, wasOffline, queueCount, syncQueue]);

  // Initial queue count
  useEffect(() => {
    refreshQueueCount();
  }, [refreshQueueCount]);

  return {
    isOnline,
    queueCount,
    isSyncing,
    syncError,
    queueScore,
    syncQueue,
    clearSyncError: () => setSyncError(null),
  };
}
