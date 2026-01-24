import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// User roles
export type UserRole = 'user' | 'admin';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('user'), // 'user' or 'admin'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
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
});

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
});

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
  lockedAt: integer('locked_at', { mode: 'timestamp' }).notNull(),
});

// Refresh tokens table
export const refreshTokens = sqliteTable('refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
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
