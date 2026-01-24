// Session Types
export type SessionStatus = 'draft' | 'waiting' | 'active' | 'paused' | 'reveal' | 'completed';
export type WhiskeyTheme = 'bourbon' | 'rye' | 'scotch-single-malt' | 'scotch-blended' | 'irish' | 'japanese' | 'world' | 'custom';
export type PourSize = '0.5oz' | '1oz';
export type TastingPhase = 'pour' | 'nosing' | 'tasting-neat' | 'tasting-water' | 'scoring' | 'palate-reset';
export type ParticipantStatus = 'waiting' | 'tasting' | 'completed';

export interface ProofRange {
  min: number;
  max: number;
}

export interface Session {
  id: string;
  name: string;
  theme: WhiskeyTheme;
  customTheme?: string;
  proofRange?: ProofRange;
  scheduledAt: Date;
  status: SessionStatus;
  moderatorId: string;
  currentWhiskeyIndex: number;
  currentPhase: TastingPhase;
  inviteCode: string;
  maxParticipants?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Whiskey Types
export interface Whiskey {
  id: string;
  sessionId: string;
  displayNumber: number;
  name: string;
  distillery: string;
  age?: number;
  proof: number;
  price?: number;
  mashbill?: string;
  region?: string;
  pourSize: PourSize;
}

// For participants - hides sensitive info until reveal
export interface WhiskeyPublic {
  id: string;
  sessionId: string;
  displayNumber: number;
  pourSize: PourSize;
}

// Participant Types
export interface Participant {
  id: string;
  sessionId: string;
  userId?: string;
  displayName: string;
  joinedAt: Date;
  status: ParticipantStatus;
  isReady: boolean;
  currentWhiskeyIndex: number;
}

// Score Types
export interface Score {
  id: string;
  sessionId: string;
  whiskeyId: string;
  participantId: string;
  nose: number;
  palate: number;
  finish: number;
  overall: number;
  totalScore: number;
  noseNotes?: string;
  palateNotes?: string;
  finishNotes?: string;
  generalNotes?: string;
  identityGuess?: string;
  lockedAt: Date;
}

export interface ScoreInput {
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

// User Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

// Results Types
export interface WhiskeyResult {
  whiskey: Whiskey;
  averageScore: number;
  scores: Score[];
  ranking: number;
  categoryWins: {
    nose: boolean;
    palate: boolean;
    finish: boolean;
  };
}

export interface SessionResults {
  session: Session;
  whiskeys: WhiskeyResult[];
  winner: WhiskeyResult;
  participantCount: number;
}

// Form Types
export interface CreateSessionForm {
  name: string;
  theme: WhiskeyTheme;
  customTheme?: string;
  proofRange?: ProofRange;
  scheduledAt: Date;
  maxParticipants?: number;
}

export interface AddWhiskeyForm {
  name: string;
  distillery: string;
  age?: number;
  proof: number;
  price?: number;
  mashbill?: string;
  region?: string;
  pourSize: PourSize;
}

export interface JoinSessionForm {
  inviteCode: string;
  displayName: string;
}

// WebSocket Event Types
export interface WSMessage {
  type: string;
  payload: unknown;
}

export type WSEventType =
  | 'session:updated'
  | 'session:started'
  | 'session:paused'
  | 'session:resumed'
  | 'session:advanced'
  | 'session:reveal'
  | 'session:ended'
  | 'participant:joined'
  | 'participant:left'
  | 'participant:ready'
  | 'score:locked';

// Social Feature Types
export interface PublicProfile {
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

export interface UserListItem {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followedAt: Date;
}

export interface PublicTastingNote {
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
  lockedAt: Date;
}

export interface ShareableScore {
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
  lockedAt: Date;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
