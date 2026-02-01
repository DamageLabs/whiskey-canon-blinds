import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// User roles
export type UserRole = 'user' | 'admin';

// Experience levels
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Whiskey categories
export type WhiskeyCategory = 'bourbon' | 'rye' | 'scotch' | 'irish' | 'japanese' | 'canadian' | 'other';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'), // Profile photo URL
  bio: text('bio'), // Short bio/tagline
  favoriteCategory: text('favorite_category'), // Favorite whiskey category
  experienceLevel: text('experience_level'), // Tasting experience level
  role: text('role').notNull().default('user'), // 'user' or 'admin'
  isProfilePublic: integer('is_profile_public', { mode: 'boolean' }).notNull().default(true), // Privacy toggle
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false), // Email verification status
  verificationCode: text('verification_code'), // Alphanumeric verification code
  verificationCodeExpiresAt: integer('verification_code_expires_at', { mode: 'timestamp' }), // Code expiration
  verificationAttempts: integer('verification_attempts').notNull().default(0), // Failed verification attempts
  verificationLockedUntil: integer('verification_locked_until', { mode: 'timestamp' }), // Lockout after too many attempts
  resetPasswordCode: text('reset_password_code'), // Alphanumeric password reset code
  resetPasswordCodeExpiresAt: integer('reset_password_code_expires_at', { mode: 'timestamp' }), // Reset code expiration
  resetPasswordAttempts: integer('reset_password_attempts').notNull().default(0), // Failed reset attempts
  resetPasswordLockedUntil: integer('reset_password_locked_until', { mode: 'timestamp' }), // Lockout after too many attempts
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete timestamp (null = not deleted)
});

// Sessions table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  theme: text('theme').notNull(),
  customTheme: text('custom_theme'),
  proofMin: integer('proof_min'),
  proofMax: integer('proof_max'),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }).notNull(),
  status: text('status').notNull().default('draft'), // draft, waiting, active, reveal, completed
  moderatorId: text('moderator_id').notNull().references(() => users.id),
  currentWhiskeyIndex: integer('current_whiskey_index').notNull().default(0),
  currentPhase: text('current_phase').notNull().default('pour'),
  inviteCode: text('invite_code').notNull().unique(),
  maxParticipants: integer('max_participants'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('sessions_moderator_id_idx').on(table.moderatorId),
  index('sessions_status_idx').on(table.status),
]);

// Whiskeys table
export const whiskeys = sqliteTable('whiskeys', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  displayNumber: integer('display_number').notNull(),
  name: text('name').notNull(),
  distillery: text('distillery').notNull(),
  age: integer('age'),
  proof: real('proof').notNull(),
  price: real('price'),
  mashbill: text('mashbill'),
  region: text('region'),
  pourSize: text('pour_size').notNull(), // '0.5oz' or '1oz'
});

// Participants table
export const participants = sqliteTable('participants', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  displayName: text('display_name').notNull(),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull(),
  status: text('status').notNull().default('waiting'), // waiting, tasting, completed
  isReady: integer('is_ready', { mode: 'boolean' }).notNull().default(false),
  currentWhiskeyIndex: integer('current_whiskey_index').notNull().default(0),
}, (table) => [
  index('participants_session_id_idx').on(table.sessionId),
  index('participants_user_id_idx').on(table.userId),
]);

// Scores table
export const scores = sqliteTable('scores', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  whiskeyId: text('whiskey_id').notNull().references(() => whiskeys.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  nose: integer('nose').notNull(),
  palate: integer('palate').notNull(),
  finish: integer('finish').notNull(),
  overall: integer('overall').notNull(),
  totalScore: real('total_score').notNull(),
  noseNotes: text('nose_notes'),
  palateNotes: text('palate_notes'),
  finishNotes: text('finish_notes'),
  generalNotes: text('general_notes'),
  identityGuess: text('identity_guess'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false), // Share to public profile
  lockedAt: integer('locked_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('scores_session_id_idx').on(table.sessionId),
  index('scores_participant_id_idx').on(table.participantId),
  index('scores_whiskey_id_idx').on(table.whiskeyId),
]);

// Refresh tokens table
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Follows table (social feature)
export const follows = sqliteTable('follows', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: text('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('follows_follower_id_idx').on(table.followerId),
  index('follows_following_id_idx').on(table.followingId),
]);

// Audit logs table (security events)
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  userId: text('user_id'),
  targetUserId: text('target_user_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Session templates table
export const sessionTemplates = sqliteTable('session_templates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  theme: text('theme').notNull(),
  customTheme: text('custom_theme'),
  proofMin: integer('proof_min'),
  proofMax: integer('proof_max'),
  maxParticipants: integer('max_participants'),
  whiskeys: text('whiskeys').notNull(), // JSON array of whiskey configs
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Comments table (for whiskey discussions)
export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  whiskeyId: text('whiskey_id').notNull().references(() => whiskeys.id, { onDelete: 'cascade' }),
  participantId: text('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'), // For threaded replies
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Leaderboard period types
export type LeaderboardPeriod = 'all_time' | 'monthly' | 'weekly';

// Leaderboard entries table
export const leaderboardEntries = sqliteTable('leaderboard_entries', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  period: text('period').notNull(), // 'all_time' | 'monthly' | 'weekly'
  periodStart: integer('period_start', { mode: 'timestamp' }).notNull(), // Start date of the period
  totalScore: real('total_score').notNull().default(0),
  sessionsCount: integer('sessions_count').notNull().default(0),
  whiskeysRated: integer('whiskeys_rated').notNull().default(0),
  averageScore: real('average_score').notNull().default(0),
  ranking: integer('ranking').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tasting notes library table
export const tastingNotesLibrary = sqliteTable('tasting_notes_library', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  whiskeyName: text('whiskey_name').notNull(),
  distillery: text('distillery'),
  category: text('category'), // bourbon, rye, scotch, etc.
  age: integer('age'),
  proof: real('proof'),
  noseNotes: text('nose_notes'),
  palateNotes: text('palate_notes'),
  finishNotes: text('finish_notes'),
  generalNotes: text('general_notes'),
  rating: real('rating'),
  sourceScoreId: text('source_score_id').references(() => scores.id, { onDelete: 'set null' }),
  sourceSessionId: text('source_session_id').references(() => sessions.id, { onDelete: 'set null' }),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  tags: text('tags'), // JSON array of tags
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tasting note tags table
export const tastingNoteTags = sqliteTable('tasting_note_tags', {
  id: text('id').primaryKey(),
  noteId: text('note_id').notNull().references(() => tastingNotesLibrary.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Push subscriptions table
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  keysP256dh: text('keys_p256dh').notNull(),
  keysAuth: text('keys_auth').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
});

// Notification preferences table
export const notificationPreferences = sqliteTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  sessionInvites: integer('session_invites', { mode: 'boolean' }).notNull().default(true),
  sessionStarting: integer('session_starting', { mode: 'boolean' }).notNull().default(true),
  sessionReveal: integer('session_reveal', { mode: 'boolean' }).notNull().default(true),
  newFollowers: integer('new_followers', { mode: 'boolean' }).notNull().default(true),
  achievements: integer('achievements', { mode: 'boolean' }).notNull().default(true),
  directMessages: integer('direct_messages', { mode: 'boolean' }).notNull().default(true),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Conversations table
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  participantIds: text('participant_ids').notNull(), // JSON array of user IDs (sorted)
  lastMessageAt: integer('last_message_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Messages table
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('messages_conversation_id_idx').on(table.conversationId),
  index('messages_sender_id_idx').on(table.senderId),
]);

// User achievements table
export const userAchievements = sqliteTable('user_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull(),
  earnedAt: integer('earned_at', { mode: 'timestamp' }).notNull(),
  notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
});

// Achievement definitions table
export const achievementDefinitions = sqliteTable('achievement_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  category: text('category').notNull(), // social, streaks, notes, identity, tasting
  criteriaType: text('criteria_type').notNull(), // sessions_count, whiskeys_rated, followers, etc.
  criteriaTarget: integer('criteria_target').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  rarity: text('rarity').notNull().default('common'), // common, uncommon, rare, epic, legendary
  points: integer('points').notNull().default(10),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Whiskey = typeof whiskeys.$inferSelect;
export type NewWhiskey = typeof whiskeys.$inferInsert;
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type SessionTemplate = typeof sessionTemplates.$inferSelect;
export type NewSessionTemplate = typeof sessionTemplates.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
export type NewLeaderboardEntry = typeof leaderboardEntries.$inferInsert;
export type TastingNoteLibrary = typeof tastingNotesLibrary.$inferSelect;
export type NewTastingNoteLibrary = typeof tastingNotesLibrary.$inferInsert;
export type TastingNoteTag = typeof tastingNoteTags.$inferSelect;
export type NewTastingNoteTag = typeof tastingNoteTags.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type AchievementDefinition = typeof achievementDefinitions.$inferSelect;
export type NewAchievementDefinition = typeof achievementDefinitions.$inferInsert;
