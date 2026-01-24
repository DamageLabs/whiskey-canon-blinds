# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start both frontend and backend in development mode
npm run dev

# Start only the Vite frontend (port 5173)
npm run dev:client

# Start only the Express backend with hot reload (port 3001)
npm run dev:server

# Run ESLint
npm run lint

# Build frontend for production
npm run build

# Build server TypeScript
npm run build:server
```

## Architecture Overview

This is a full-stack blind whiskey tasting application with real-time synchronization.

### Frontend (React 19 + TypeScript)

**State Management**: Zustand stores in `src/store/`
- `authStore.ts` - User authentication state, persisted to localStorage
- `sessionStore.ts` - Tasting session state, WebSocket event handlers

**Routing**: React Router v7 with layout wrapper in `src/components/layout/Layout.tsx`

**API Client**: `src/services/api.ts` handles REST calls with automatic token injection from localStorage (`accessToken`, `participantToken`)

**Forms**: React Hook Form + Zod schemas for validation

### Backend (Express 5 + SQLite)

**Database**: SQLite via Drizzle ORM. Schema in `server/src/db/schema.ts`. Tables: users, sessions, whiskeys, participants, scores, refreshTokens.

**Authentication**: Three token types in `server/src/middleware/auth.ts`:
- Access token (JWT) - Registered user authentication
- Refresh token - Token renewal
- Participant token - Guest participant authentication for sessions

**Real-time**: Socket.io in `server/src/socket/index.ts`. Participants join session rooms; events broadcast phase changes, scores, and status updates.

**Routes**:
- `/api/auth/*` - Authentication (register, login, profile updates, avatar upload)
- `/api/sessions/*` - Session CRUD, join, start, advance phase, reveal
- `/api/scores/*` - Score submission
- `/api/admin/*` - Admin-only user/session management

### Key Patterns

**Moderator vs Participant**: Sessions have one moderator (creator) who controls progression. Participants join via invite code and can only submit scores.

**Session Flow**: draft → waiting → active → reveal → completed. Phase progression: pour → nose → palate → palate-water → score → palate-reset (repeat for each whiskey).

**Anti-anchoring**: Scores are isolated per participant until moderator initiates reveal. No score sharing during active tasting.

### Database Changes

When adding columns to existing tables, run ALTER TABLE directly on `data/whiskey.db`:
```bash
sqlite3 data/whiskey.db "ALTER TABLE table_name ADD COLUMN column_name TYPE;"
```

### File Uploads

Avatar uploads stored in `uploads/avatars/`. Multer configured in `server/src/routes/auth.ts`. Static serving at `/uploads`.

## Git Conventions

- Do not add Co-Authored-By lines unless explicitly requested
- Git user email: fusion94@gmail.com
- Update CHANGELOG.md with changes following Keep a Changelog format
