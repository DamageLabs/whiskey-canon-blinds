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
    request<{ id: string; email: string; displayName: string; role: UserRole; createdAt: string }>('/auth/me'),
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

export { ApiError };
