const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (!skipAuth) {
    // Add access token if available (for user auth)
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
    }

    // Add participant token if available
    const participantToken = localStorage.getItem('participantToken');
    if (participantToken) {
      (headers as Record<string, string>)['x-participant-token'] = participantToken;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

// Auth API
export type UserRole = 'user' | 'admin';

export const authApi = {
  register: (data: { email: string; password: string; displayName: string }) =>
    request<{ user: { id: string; email: string; displayName: string; role: UserRole }; accessToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  login: (data: { email: string; password: string }) =>
    request<{ user: { id: string; email: string; displayName: string; role: UserRole }; accessToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  refresh: () =>
    request<{ accessToken: string }>('/auth/refresh', { method: 'POST' }),

  me: () =>
    request<{
      id: string;
      email: string;
      displayName: string;
      role: UserRole;
      avatarUrl?: string | null;
      bio?: string | null;
      favoriteCategory?: string | null;
      experienceLevel?: string | null;
      isProfilePublic?: boolean;
      createdAt: string;
    }>('/auth/me'),
};

// Sessions API
export interface SessionResponse {
  id: string;
  name: string;
  theme: string;
  customTheme?: string;
  proofMin?: number;
  proofMax?: number;
  status: string;
  moderatorId: string;
  currentWhiskeyIndex: number;
  currentPhase: string;
  inviteCode: string;
  isModerator?: boolean;
  currentParticipantId?: string;
  whiskeys: Array<{
    id: string;
    displayNumber: number;
    pourSize: string;
    name?: string;
    distillery?: string;
    age?: number;
    proof?: number;
    price?: number;
  }>;
  participants: Array<{
    id: string;
    displayName: string;
    status: string;
    isReady: boolean;
    currentWhiskeyIndex: number;
  }>;
}

export interface CreateSessionData {
  name: string;
  hostName: string;
  theme: string;
  customTheme?: string;
  proofMin?: number;
  proofMax?: number;
  maxParticipants?: number;
  whiskeys: Array<{
    name: string;
    distillery: string;
    age?: number;
    proof: number;
    price?: number;
    pourSize: string;
  }>;
}

export const sessionsApi = {
  create: (data: CreateSessionData) =>
    request<{ id: string; inviteCode: string; participantId: string; participantToken: string }>(
      '/sessions',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  get: (sessionId: string) =>
    request<SessionResponse>(`/sessions/${sessionId}`),

  join: (data: { inviteCode: string; displayName: string }) =>
    request<{ sessionId: string; participantId: string; participantToken: string; isModerator?: boolean; session: { id: string; name: string; theme: string; status: string } }>(
      '/sessions/join',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  start: (sessionId: string) =>
    request<{ message: string }>(`/sessions/${sessionId}/start`, { method: 'POST' }),

  advance: (sessionId: string, data: { phase?: string; whiskeyIndex?: number }) =>
    request<{ phase: string; whiskeyIndex: number }>(
      `/sessions/${sessionId}/advance`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  reveal: (sessionId: string) =>
    request<{ whiskeys: unknown[]; scores: unknown[] }>(
      `/sessions/${sessionId}/reveal`,
      { method: 'POST' }
    ),

  end: (sessionId: string) =>
    request<{ message: string }>(`/sessions/${sessionId}/end`, { method: 'POST' }),

  list: () =>
    request<SessionResponse[]>('/sessions'),
};

// Scores API
export interface ScoreData {
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
}

export interface SessionResults {
  session: SessionResponse;
  results: Array<{
    whiskey: {
      id: string;
      name: string;
      distillery: string;
      age?: number;
      proof: number;
      price?: number;
      displayNumber: number;
    };
    averageScore: number;
    categoryAverages: {
      nose: number;
      palate: number;
      finish: number;
      overall: number;
    };
    scores: Array<{
      id: string;
      nose: number;
      palate: number;
      finish: number;
      overall: number;
      totalScore: number;
      participantName?: string;
    }>;
    ranking: number;
  }>;
  participantCount: number;
}

export const scoresApi = {
  submit: (data: ScoreData) =>
    request<{ id: string; totalScore: number; lockedAt: string }>(
      '/scores',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getSessionResults: (sessionId: string) =>
    request<SessionResults>(`/scores/session/${sessionId}`),

  getMyScores: (sessionId: string) =>
    request<ScoreData[]>(`/scores/my-scores/${sessionId}`),
};

// Participants API
export const participantsApi = {
  ready: () =>
    request<{ message: string }>('/participants/ready', { method: 'POST' }),

  updateStatus: (status: string) =>
    request<{ message: string }>(
      '/participants/status',
      { method: 'PATCH', body: JSON.stringify({ status }) }
    ),

  leave: () =>
    request<{ message: string }>('/participants/leave', { method: 'DELETE' }),

  me: () =>
    request<{
      id: string;
      sessionId: string;
      displayName: string;
      status: string;
      isReady: boolean;
      currentWhiskeyIndex: number;
    }>('/participants/me'),
};

// Social API
export interface PublicProfileResponse {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  favoriteCategory?: string | null;
  experienceLevel?: string | null;
  isProfilePublic: boolean;
  isOwner: boolean;
  isFollowing: boolean;
  isPrivate?: boolean;
  stats: {
    followers: number;
    following: number;
    publicNotes: number;
  };
}

export interface UserListItemResponse {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followedAt: string;
}

export interface PaginatedResponse {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FollowersResponse extends PaginatedResponse {
  followers: UserListItemResponse[];
}

export interface FollowingResponse extends PaginatedResponse {
  following: UserListItemResponse[];
}

export interface PublicTastingNoteResponse {
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
  lockedAt: string;
}

export interface PublicNotesResponse extends PaginatedResponse {
  notes: PublicTastingNoteResponse[];
}

export interface ShareableScoreResponse {
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
    status: string;
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
  isPublic: boolean;
  lockedAt: string;
}

// Tasting Stats Types
export interface TastingStatsResponse {
  overview: {
    sessionsAttended: number;
    whiskeysRated: number;
    categoriesExplored: string[];
  };
  scoringTendencies: {
    averages: {
      nose: number;
      palate: number;
      finish: number;
      overall: number;
      total: number;
    };
    distribution: Record<number, number>;
    tendency: 'generous' | 'balanced' | 'critical';
  };
  favoriteNotes: Array<{ term: string; count: number }>;
  recentActivity: Array<{
    id: string;
    name: string;
    theme: string;
    completedAt: string;
  }>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  progress: number;
  target: number;
}

export interface AchievementsResponse {
  achievements: Achievement[];
  summary: {
    earned: number;
    total: number;
    percentage: number;
  };
}

// Data Export API
export const dataExportApi = {
  // Download personal data export (GDPR)
  downloadAllData: async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/auth/me/export`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new ApiError(response.status, error.error || 'Download failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whiskey-canon-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Download tasting history as CSV
  downloadTastingsCSV: async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/auth/me/export/tastings?format=csv`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new ApiError(response.status, error.error || 'Download failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasting-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Download tasting history as PDF (generates printable HTML)
  downloadTastingsPDF: async () => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/auth/me/export/tastings?format=json`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new ApiError(response.status, error.error || 'Download failed');
    }
    const data = await response.json();

    // Generate printable HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Tasting History - Whiskey Canon</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #d97706; padding-bottom: 10px; }
    .export-date { color: #666; font-size: 14px; margin-bottom: 30px; }
    .tasting { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid; }
    .tasting-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
    .whiskey-name { font-size: 18px; font-weight: bold; color: #333; }
    .distillery { color: #666; font-size: 14px; }
    .date { color: #999; font-size: 12px; }
    .session { color: #666; font-size: 13px; margin-top: 4px; }
    .scores { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 6px; }
    .score { text-align: center; }
    .score-value { font-size: 24px; font-weight: bold; color: #d97706; }
    .score-label { font-size: 11px; color: #666; text-transform: uppercase; }
    .notes { margin-top: 15px; }
    .note-section { margin-bottom: 10px; }
    .note-label { font-weight: 600; color: #444; font-size: 13px; }
    .note-text { color: #555; font-size: 14px; margin-top: 2px; }
    .whiskey-details { color: #888; font-size: 13px; margin-top: 4px; }
    @media print { body { padding: 20px; } .tasting { border: 1px solid #ccc; } }
  </style>
</head>
<body>
  <h1>Tasting History</h1>
  <div class="export-date">Exported on ${new Date(data.exportDate).toLocaleDateString()}</div>
  ${data.tastings.map((t: { date: string; sessionName: string; whiskeyName: string; distillery: string; age: number | string; proof: number | string; noseScore: number; palateScore: number; finishScore: number; overallScore: number; totalScore: number; noseNotes?: string; palateNotes?: string; finishNotes?: string; generalNotes?: string; identityGuess?: string }) => `
    <div class="tasting">
      <div class="tasting-header">
        <div>
          <div class="whiskey-name">${t.whiskeyName || 'Unknown Whiskey'}</div>
          <div class="distillery">${t.distillery || ''}</div>
          <div class="whiskey-details">${t.age ? `${t.age} years` : ''} ${t.proof ? `• ${t.proof} proof` : ''}</div>
          <div class="session">Session: ${t.sessionName}</div>
        </div>
        <div class="date">${t.date ? new Date(t.date).toLocaleDateString() : ''}</div>
      </div>
      <div class="scores">
        <div class="score"><div class="score-value">${t.noseScore}</div><div class="score-label">Nose</div></div>
        <div class="score"><div class="score-value">${t.palateScore}</div><div class="score-label">Palate</div></div>
        <div class="score"><div class="score-value">${t.finishScore}</div><div class="score-label">Finish</div></div>
        <div class="score"><div class="score-value">${t.overallScore}</div><div class="score-label">Overall</div></div>
        <div class="score"><div class="score-value">${t.totalScore.toFixed(1)}</div><div class="score-label">Total</div></div>
      </div>
      ${(t.noseNotes || t.palateNotes || t.finishNotes || t.generalNotes) ? `
        <div class="notes">
          ${t.noseNotes ? `<div class="note-section"><div class="note-label">Nose Notes</div><div class="note-text">${t.noseNotes}</div></div>` : ''}
          ${t.palateNotes ? `<div class="note-section"><div class="note-label">Palate Notes</div><div class="note-text">${t.palateNotes}</div></div>` : ''}
          ${t.finishNotes ? `<div class="note-section"><div class="note-label">Finish Notes</div><div class="note-text">${t.finishNotes}</div></div>` : ''}
          ${t.generalNotes ? `<div class="note-section"><div class="note-label">General Notes</div><div class="note-text">${t.generalNotes}</div></div>` : ''}
        </div>
      ` : ''}
      ${t.identityGuess ? `<div class="note-section"><div class="note-label">Identity Guess</div><div class="note-text">${t.identityGuess}</div></div>` : ''}
    </div>
  `).join('')}
  ${data.tastings.length === 0 ? '<p style="color: #666; text-align: center; padding: 40px;">No tasting notes yet.</p>' : ''}
</body>
</html>`;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  },
};

// Session Results Export API
export const resultsExportApi = {
  // Export session results as CSV
  downloadCSV: (results: SessionResults) => {
    const { session, results: whiskeyResults, participantCount } = results;

    // Build CSV content
    const headers = ['Rank', 'Whiskey', 'Distillery', 'Age', 'Proof', 'Price', 'Avg Score', 'Nose', 'Palate', 'Finish', 'Overall'];
    const rows = whiskeyResults.map(r => [
      r.ranking,
      `"${r.whiskey.name}"`,
      `"${r.whiskey.distillery}"`,
      r.whiskey.age || '',
      r.whiskey.proof,
      r.whiskey.price ? `$${r.whiskey.price}` : '',
      r.averageScore.toFixed(2),
      r.categoryAverages.nose.toFixed(2),
      r.categoryAverages.palate.toFixed(2),
      r.categoryAverages.finish.toFixed(2),
      r.categoryAverages.overall.toFixed(2),
    ]);

    const csv = [
      `# Session: ${session.name}`,
      `# Theme: ${session.theme}${session.customTheme ? ` (${session.customTheme})` : ''}`,
      `# Participants: ${participantCount}`,
      `# Exported: ${new Date().toISOString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-results.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Export session results as PDF (via print dialog)
  downloadPDF: (results: SessionResults) => {
    const { session, results: whiskeyResults, participantCount } = results;
    const winner = whiskeyResults[0];

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${session.name} - Results</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #333; border-bottom: 2px solid #d97706; padding-bottom: 10px; margin-bottom: 5px; }
    .session-info { color: #666; font-size: 14px; margin-bottom: 30px; }
    .winner-card { background: linear-gradient(135deg, #fef3c7, #fde68a); border: 2px solid #d97706; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 30px; }
    .winner-label { color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .winner-name { font-size: 28px; font-weight: bold; color: #78350f; margin-bottom: 4px; }
    .winner-distillery { color: #92400e; font-size: 16px; margin-bottom: 12px; }
    .winner-score { font-size: 36px; font-weight: bold; color: #d97706; }
    .results-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .results-table th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    .results-table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .rank { font-weight: bold; color: #d97706; font-size: 18px; }
    .rank-1 { color: #d97706; }
    .rank-2 { color: #6b7280; }
    .rank-3 { color: #92400e; }
    .whiskey-name { font-weight: 600; color: #1f2937; }
    .whiskey-details { color: #6b7280; font-size: 13px; }
    .score { font-weight: 600; color: #d97706; font-size: 18px; }
    .category-scores { display: flex; gap: 16px; }
    .category { text-align: center; }
    .category-value { font-weight: 500; color: #374151; }
    .category-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; }
    @media print {
      body { padding: 20px; }
      .winner-card { background: #fef3c7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>${session.name}</h1>
  <div class="session-info">
    Theme: ${session.theme}${session.customTheme ? ` (${session.customTheme})` : ''} &bull;
    ${participantCount} participant${participantCount !== 1 ? 's' : ''} &bull;
    ${new Date().toLocaleDateString()}
  </div>

  ${winner ? `
  <div class="winner-card">
    <div class="winner-label">Winner</div>
    <div class="winner-name">${winner.whiskey.name}</div>
    <div class="winner-distillery">${winner.whiskey.distillery}</div>
    <div class="winner-score">${winner.averageScore.toFixed(1)} / 10</div>
  </div>
  ` : ''}

  <table class="results-table">
    <thead>
      <tr>
        <th>Rank</th>
        <th>Whiskey</th>
        <th>Score</th>
        <th>Nose</th>
        <th>Palate</th>
        <th>Finish</th>
        <th>Overall</th>
      </tr>
    </thead>
    <tbody>
      ${whiskeyResults.map(r => `
        <tr>
          <td class="rank rank-${r.ranking}">#${r.ranking}</td>
          <td>
            <div class="whiskey-name">${r.whiskey.name}</div>
            <div class="whiskey-details">
              ${r.whiskey.distillery}
              ${r.whiskey.age ? ` &bull; ${r.whiskey.age}yr` : ''}
              ${r.whiskey.proof ? ` &bull; ${r.whiskey.proof}°` : ''}
              ${r.whiskey.price ? ` &bull; $${r.whiskey.price}` : ''}
            </div>
          </td>
          <td class="score">${r.averageScore.toFixed(1)}</td>
          <td class="category-value">${r.categoryAverages.nose.toFixed(1)}</td>
          <td class="category-value">${r.categoryAverages.palate.toFixed(1)}</td>
          <td class="category-value">${r.categoryAverages.finish.toFixed(1)}</td>
          <td class="category-value">${r.categoryAverages.overall.toFixed(1)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px;">
    Generated by Whiskey Canon Blinds
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  },
};

export const socialApi = {
  // Follow system
  follow: (userId: string) =>
    request<{ message: string }>(`/social/follow/${userId}`, { method: 'POST' }),

  unfollow: (userId: string) =>
    request<{ message: string }>(`/social/follow/${userId}`, { method: 'DELETE' }),

  getFollowers: (userId: string, page = 1, limit = 20) =>
    request<FollowersResponse>(`/social/followers/${userId}?page=${page}&limit=${limit}`),

  getFollowing: (userId: string, page = 1, limit = 20) =>
    request<FollowingResponse>(`/social/following/${userId}?page=${page}&limit=${limit}`),

  isFollowing: (userId: string) =>
    request<{ isFollowing: boolean }>(`/social/is-following/${userId}`),

  // Profile
  getProfile: (userId: string) =>
    request<PublicProfileResponse>(`/social/profile/${userId}`),

  togglePrivacy: (isPublic: boolean) =>
    request<{ isProfilePublic: boolean }>('/social/profile/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    }),

  // Public notes
  getPublicNotes: (userId: string, page = 1, limit = 10) =>
    request<PublicNotesResponse>(`/social/profile/${userId}/notes?page=${page}&limit=${limit}`),

  // Tasting stats
  getTastingStats: (userId: string) =>
    request<TastingStatsResponse>(`/social/profile/${userId}/stats`),

  getAchievements: (userId: string) =>
    request<AchievementsResponse>(`/social/profile/${userId}/achievements`),

  // Score visibility
  toggleScoreVisibility: (scoreId: string, isPublic: boolean) =>
    request<{ id: string; isPublic: boolean }>(`/scores/${scoreId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    }),

  getShareableScores: () =>
    request<ShareableScoreResponse[]>('/scores/shareable'),
};

export { ApiError };
