const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipCsrf?: boolean;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// CSRF token management
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/csrf-token`, {
    credentials: 'include',
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('401: Authentication required for CSRF token');
    }
    throw new Error('Failed to fetch CSRF token');
  }
  const data = await response.json();
  return data.csrfToken;
}

async function getCsrfToken(): Promise<string | null> {
  // Return cached token if available
  if (csrfToken) {
    return csrfToken;
  }

  // Deduplicate concurrent requests
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().then(token => {
      csrfToken = token;
      csrfTokenPromise = null;
      return token;
    }).catch(err => {
      csrfTokenPromise = null;
      // Return null instead of throwing - caller will proceed without CSRF token
      // This handles the case where user is not authenticated
      if (err?.message?.includes('401') || err?.message?.includes('Authentication')) {
        return null;
      }
      throw err;
    });
  }

  return csrfTokenPromise;
}

// Clear CSRF token (call on logout or when token is invalidated)
export function clearCsrfToken(): void {
  csrfToken = null;
  csrfTokenPromise = null;
}

// Routes exempt from CSRF (auth endpoints that don't require prior authentication)
const csrfExemptEndpoints = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/sessions/join',
];

function isStateChangingMethod(method?: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method?.toUpperCase() || '');
}

function isCsrfExempt(endpoint: string): boolean {
  return csrfExemptEndpoints.some(exempt => endpoint === exempt || endpoint.startsWith(exempt + '?'));
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth: _skipAuth, skipCsrf, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  // Authentication is handled via httpOnly cookies (set by backend)
  // Cookies are automatically sent with credentials: 'include'

  // Add CSRF token for state-changing requests (unless exempt)
  if (!skipCsrf && isStateChangingMethod(fetchOptions.method) && !isCsrfExempt(endpoint)) {
    try {
      const token = await getCsrfToken();
      if (token) {
        (headers as Record<string, string>)['x-csrf-token'] = token;
      }
    } catch {
      // CSRF token fetch failed (likely not authenticated), continue without it
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Include cookies
  });

  // If CSRF token is invalid, clear it and retry once
  if (response.status === 403 && isStateChangingMethod(fetchOptions.method)) {
    const errorData = await response.clone().json().catch(() => ({}));
    if (errorData.error?.toLowerCase().includes('csrf')) {
      clearCsrfToken();
      // Retry with fresh token (only if authenticated)
      const token = await getCsrfToken();
      if (token) {
        (headers as Record<string, string>)['x-csrf-token'] = token;

        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...fetchOptions,
          headers,
          credentials: 'include',
        });

        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({ error: 'Request failed' }));
          throw new ApiError(retryResponse.status, error.error || 'Request failed');
        }

        return retryResponse.json();
      }
    }
  }

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
    request<{
      message: string;
      requiresVerification: boolean;
      email: string;
      devCode?: string;
    }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  verifyEmail: (data: { email: string; code: string }) =>
    request<{
      user: { id: string; email: string; displayName: string; role: UserRole };
      accessToken: string;
    }>(
      '/auth/verify-email',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  resendVerification: (data: { email: string }) =>
    request<{ message: string; devCode?: string }>(
      '/auth/resend-verification',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  forgotPassword: (data: { email: string }) =>
    request<{ message: string; devCode?: string }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    request<{ message: string }>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  login: (data: { email: string; password: string }) =>
    request<{ user: { id: string; email: string; displayName: string; role: UserRole }; accessToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  logout: async () => {
    const result = await request<{ message: string }>('/auth/logout', { method: 'POST' });
    clearCsrfToken();
    return result;
  },

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
  scheduledAt?: string;
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

  pause: (sessionId: string) =>
    request<{ message: string }>(`/sessions/${sessionId}/pause`, { method: 'POST' }),

  resume: (sessionId: string) =>
    request<{ message: string }>(`/sessions/${sessionId}/resume`, { method: 'POST' }),

  end: (sessionId: string) =>
    request<{ message: string }>(`/sessions/${sessionId}/end`, { method: 'POST' }),

  list: () =>
    request<SessionResponse[]>('/sessions'),

  duplicate: (sessionId: string) =>
    request<{ id: string; inviteCode: string; message: string }>(
      `/sessions/${sessionId}/duplicate`,
      { method: 'POST' }
    ),

  sendInvite: (sessionId: string, email: string) =>
    request<{ message: string }>(
      `/sessions/${sessionId}/invite`,
      { method: 'POST', body: JSON.stringify({ email }) }
    ),

  exportPdf: async (sessionId: string, sessionName: string) => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/export/pdf`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Download failed' }));
      throw new Error(error.error || 'Download failed');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-results.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
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
    const response = await fetch(`${API_BASE_URL}/auth/me/export`, {
      credentials: 'include', // Send httpOnly cookies for authentication
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
    const response = await fetch(`${API_BASE_URL}/auth/me/export/tastings?format=csv`, {
      credentials: 'include', // Send httpOnly cookies for authentication
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
    const response = await fetch(`${API_BASE_URL}/auth/me/export/tastings?format=json`, {
      credentials: 'include', // Send httpOnly cookies for authentication
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

// Templates API
export interface TemplateWhiskey {
  name: string;
  distillery: string;
  age?: number;
  proof: number;
  price?: number;
  pourSize: string;
}

export interface SessionTemplate {
  id: string;
  userId: string;
  name: string;
  theme: string;
  customTheme?: string;
  proofMin?: number;
  proofMax?: number;
  maxParticipants?: number;
  whiskeys: TemplateWhiskey[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export const templatesApi = {
  getAll: () =>
    request<SessionTemplate[]>('/templates'),

  get: (templateId: string) =>
    request<SessionTemplate>(`/templates/${templateId}`),

  create: (data: Omit<SessionTemplate, 'id' | 'userId' | 'usageCount' | 'createdAt' | 'updatedAt'>) =>
    request<SessionTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (templateId: string, data: Partial<Omit<SessionTemplate, 'id' | 'userId' | 'usageCount' | 'createdAt' | 'updatedAt'>>) =>
    request<SessionTemplate>(`/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (templateId: string) =>
    request<{ message: string }>(`/templates/${templateId}`, { method: 'DELETE' }),

  use: (templateId: string) =>
    request<{ message: string }>(`/templates/${templateId}/use`, { method: 'POST' }),
};

// Comments API
export interface Comment {
  id: string;
  sessionId: string;
  whiskeyId: string;
  participantId: string;
  parentId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  participantName: string;
  isOwn: boolean;
}

export const commentsApi = {
  getForWhiskey: (sessionId: string, whiskeyId: string) =>
    request<Comment[]>(`/comments/session/${sessionId}/whiskey/${whiskeyId}`),

  create: (data: { sessionId: string; whiskeyId: string; content: string; parentId?: string }) =>
    request<Comment>('/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (commentId: string, content: string) =>
    request<Comment>(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  delete: (commentId: string) =>
    request<{ message: string }>(`/comments/${commentId}`, { method: 'DELETE' }),
};

// Analytics API
export interface AnalyticsTrend {
  date: string;
  averageScore: number;
  averageNose: number;
  averagePalate: number;
  averageFinish: number;
  averageOverall: number;
  count: number;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalWhiskeys: number;
  averageScore: number;
  categoryAverages: {
    nose: number;
    palate: number;
    finish: number;
    overall: number;
  };
}

export interface AnalyticsRanking {
  id: string;
  whiskey: {
    id: string;
    name: string;
    distillery: string;
    age?: number;
    proof: number;
  };
  score: number;
  nose: number;
  palate: number;
  finish: number;
  overall: number;
  scoredAt: string;
}

export interface AnalyticsSession {
  id: string;
  name: string;
  theme: string;
  customTheme?: string;
  status: string;
  isModerator: boolean;
  createdAt: string;
  whiskeyCount: number;
  participantCount: number;
  groupAverage: number;
  userAverage: number | null;
  scoreDifference: number | null;
}

export interface AnalyticsDistribution {
  distribution: Record<string, number>;
  total: number;
  average: number;
}

export const analyticsApi = {
  getTrends: (days = 90) =>
    request<{ trends: AnalyticsTrend[]; summary: AnalyticsSummary }>(`/analytics/trends?days=${days}`),

  getRankings: (limit = 20) =>
    request<{ rankings: AnalyticsRanking[] }>(`/analytics/rankings?limit=${limit}`),

  getSessions: (limit = 20) =>
    request<{ sessions: AnalyticsSession[] }>(`/analytics/sessions?limit=${limit}`),

  getDistribution: () =>
    request<AnalyticsDistribution>('/analytics/distribution'),
};

// Upcoming Sessions API
export interface UpcomingSession {
  id: string;
  name: string;
  theme: string;
  customTheme?: string;
  status: string;
  scheduledAt: string;
  isModerator: boolean;
  participantCount: number;
  inviteCode: string;
}

export const upcomingSessionsApi = {
  get: () =>
    request<UpcomingSession[]>('/sessions/upcoming'),
};

// Leaderboard API
export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly';

export interface LeaderboardEntry {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalScore: number;
  sessionsCount: number;
  whiskeysRated: number;
  averageScore: number;
  ranking: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  period: LeaderboardPeriod;
  periodStart: string;
}

export interface MyRankResponse {
  ranks: Record<LeaderboardPeriod, {
    ranking: number;
    totalScore: number;
    sessionsCount: number;
    whiskeysRated: number;
    averageScore: number;
    periodStart: string;
  } | null>;
}

export const leaderboardApi = {
  get: (period: LeaderboardPeriod = 'all_time', page = 1, limit = 20) =>
    request<LeaderboardResponse>(`/leaderboards?period=${period}&page=${page}&limit=${limit}`),

  getMyRank: () =>
    request<MyRankResponse>('/leaderboards/my-rank'),
};

// Tasting Notes Library API
export interface TastingNoteLibrary {
  id: string;
  userId: string;
  whiskeyName: string;
  distillery?: string | null;
  category?: string | null;
  age?: number | null;
  proof?: number | null;
  noseNotes?: string | null;
  palateNotes?: string | null;
  finishNotes?: string | null;
  generalNotes?: string | null;
  rating?: number | null;
  sourceScoreId?: string | null;
  sourceSessionId?: string | null;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotesListResponse {
  notes: TastingNoteLibrary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TagCloudResponse {
  tags: Array<{ tag: string; count: number }>;
}

export const notesLibraryApi = {
  list: (params?: { search?: string; category?: string; tag?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.tag) searchParams.set('tag', params.tag);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    return request<NotesListResponse>(`/notes?${searchParams.toString()}`);
  },

  get: (id: string) =>
    request<TastingNoteLibrary>(`/notes/${id}`),

  create: (data: Omit<TastingNoteLibrary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    request<TastingNoteLibrary>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Omit<TastingNoteLibrary, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) =>
    request<TastingNoteLibrary>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/notes/${id}`, { method: 'DELETE' }),

  import: (scoreId: string) =>
    request<TastingNoteLibrary>(`/notes/import/${scoreId}`, { method: 'POST' }),

  getTags: () =>
    request<TagCloudResponse>('/notes/tags'),
};

// Notifications API
export interface NotificationPreferences {
  sessionInvites: boolean;
  sessionStarting: boolean;
  sessionReveal: boolean;
  newFollowers: boolean;
  achievements: boolean;
  directMessages: boolean;
}

export const notificationsApi = {
  getVapidKey: () =>
    request<{ publicKey: string }>('/notifications/vapid-key'),

  subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ message: string }>('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),

  unsubscribe: (endpoint: string) =>
    request<{ message: string }>('/notifications/unsubscribe', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }),

  getPreferences: () =>
    request<NotificationPreferences>('/notifications/preferences'),

  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),
};

// Messaging API
export interface ConversationPreview {
  id: string;
  otherUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    isOwn: boolean;
  } | null;
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  readAt: string | null;
  createdAt: string;
  isOwn: boolean;
  sender: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface MessagesResponse {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const messagingApi = {
  getConversations: () =>
    request<{ conversations: ConversationPreview[] }>('/messages/conversations'),

  getOrCreateConversation: (userId: string) =>
    request<{ id: string; otherUser: { id: string; displayName: string; avatarUrl: string | null } }>(`/messages/conversations/${userId}`),

  getMessages: (conversationId: string, page = 1) =>
    request<MessagesResponse>(`/messages/${conversationId}?page=${page}`),

  sendMessage: (conversationId: string, content: string) =>
    request<Message>(`/messages/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  markAsRead: (conversationId: string) =>
    request<{ message: string }>(`/messages/${conversationId}/read`, { method: 'POST' }),

  getUnreadCount: () =>
    request<{ unreadCount: number }>('/messages/unread-count'),

  canMessage: (userId: string) =>
    request<{ canMessage: boolean; reason: string | null }>(`/messages/can-message/${userId}`),
};

// Enhanced Achievements API
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points: number;
  earned: boolean;
  earnedAt: string | null;
  progress: number;
  target: number;
  percentComplete: number;
}

export interface AchievementsProgressResponse {
  achievements: AchievementDefinition[];
  summary: {
    earned: number;
    total: number;
    percentage: number;
    totalPoints: number;
  };
}

export interface UnclaimedAchievement {
  id: string;
  achievementId: string;
  earnedAt: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  points: number;
}

export interface AchievementLeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  achievementCount: number;
  ranking: number;
}

export const achievementsApi = {
  getAll: () =>
    request<{ achievements: AchievementDefinition[] }>('/achievements'),

  getMyProgress: () =>
    request<AchievementsProgressResponse>('/achievements/my-progress'),

  claim: (achievementId: string) =>
    request<{ message: string }>(`/achievements/${achievementId}/claim`, { method: 'POST' }),

  getUnclaimed: () =>
    request<{ unclaimed: UnclaimedAchievement[] }>('/achievements/unclaimed'),

  getLeaderboard: (page = 1, limit = 20) =>
    request<{
      entries: AchievementLeaderboardEntry[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/achievements/leaderboard?page=${page}&limit=${limit}`),
};

export { ApiError };
