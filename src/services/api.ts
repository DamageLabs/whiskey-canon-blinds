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

export interface PaginatedResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FollowersResponse extends PaginatedResponse<UserListItemResponse> {
  followers: UserListItemResponse[];
}

export interface FollowingResponse extends PaginatedResponse<UserListItemResponse> {
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

export interface PublicNotesResponse extends PaginatedResponse<PublicTastingNoteResponse> {
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
