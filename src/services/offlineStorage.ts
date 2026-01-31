// IndexedDB wrapper for offline storage

const DB_NAME = 'whiskey-canon-offline';
const DB_VERSION = 1;
const SCORE_QUEUE_STORE = 'score-queue';

interface QueuedScore {
  id: string;
  sessionId: string;
  whiskeyId: string;
  nose: number;
  palate: number;
  finish: number;
  overall: number;
  noseNotes?: string;
  palateNotes?: string;
  finishNotes?: string;
  generalNotes?: string;
  identityGuess?: string;
  timestamp: number;
}

let db: IDBDatabase | null = null;

async function getDatabase(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create score queue store
      if (!database.objectStoreNames.contains(SCORE_QUEUE_STORE)) {
        database.createObjectStore(SCORE_QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}

export const offlineStorage = {
  // Queue a score for submission when back online
  async queueScore(score: Omit<QueuedScore, 'id' | 'timestamp'>): Promise<void> {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SCORE_QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(SCORE_QUEUE_STORE);

      const queuedScore: QueuedScore = {
        ...score,
        id: `${score.sessionId}-${score.whiskeyId}-${Date.now()}`,
        timestamp: Date.now(),
      };

      const request = store.add(queuedScore);

      request.onerror = () => {
        reject(new Error('Failed to queue score'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  },

  // Get all queued scores
  async getQueuedScores(): Promise<QueuedScore[]> {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SCORE_QUEUE_STORE, 'readonly');
      const store = transaction.objectStore(SCORE_QUEUE_STORE);
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error('Failed to get queued scores'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  },

  // Remove a score from the queue (after successful submission)
  async removeQueuedScore(id: string): Promise<void> {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SCORE_QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(SCORE_QUEUE_STORE);
      const request = store.delete(id);

      request.onerror = () => {
        reject(new Error('Failed to remove queued score'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  },

  // Clear all queued scores
  async clearQueue(): Promise<void> {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SCORE_QUEUE_STORE, 'readwrite');
      const store = transaction.objectStore(SCORE_QUEUE_STORE);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear queue'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  },

  // Get count of queued items
  async getQueueCount(): Promise<number> {
    const database = await getDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(SCORE_QUEUE_STORE, 'readonly');
      const store = transaction.objectStore(SCORE_QUEUE_STORE);
      const request = store.count();

      request.onerror = () => {
        reject(new Error('Failed to count queued items'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  },
};
