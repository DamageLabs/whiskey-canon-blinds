# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Max participants setting in session creation
  - Optional field to limit session capacity (2-50 participants)
  - Backend enforcement rejects joins when session is full

### Security
- Phase 2 security improvements
  - Reduced token expiration times (access/participant tokens: 24h → 15m, with 7-day refresh)
  - Strengthened password requirements (12+ characters, uppercase, lowercase, number)
  - Added CSRF protection for state-changing requests via `csrf-csrf` package
  - Configured Helmet with explicit CSP, HSTS, frame-guard, and referrer policies
  - Implemented audit logging for security-sensitive events:
    - User login/logout, registration, password changes/resets
    - Email changes, role changes, data exports
  - New `audit_logs` database table with indexed queries
  - Frontend automatically fetches and includes CSRF tokens on protected endpoints

## [d0dadaa] - 2026-01-24

### Added
- Tasting Protocol Guide page (`/guide`)
  - Quick reference rules for hosting blind tastings
  - Detailed tasting flow with all six phases
  - Scoring system with category weights (nose 25%, palate 35%, finish 25%, overall 15%)
  - Scoring guidelines reference (1-10 scale descriptions)
  - Anti-anchoring rules explanation
  - Tips for hosts
- Footer navigation links (Tasting Guide, Host a Tasting, Join a Session)

## [0e58dd6] - 2026-01-24

### Added
- Data export and GDPR compliance features
  - Export all personal data as JSON (account, sessions, scores, social data)
  - Download tasting history as CSV spreadsheet
  - Print/save tasting history as PDF
  - New API endpoints: `GET /api/auth/me/export`, `GET /api/auth/me/export/tastings`
  - Data & Privacy section on Profile page with export buttons

## [9339476] - 2026-01-24

### Added
- Tasting statistics on public profiles
  - Sessions attended count
  - Whiskeys rated count
  - Categories explored with labels
  - Score distribution visualization
  - Scoring tendency analysis (generous/balanced/critical)
  - Average scores by category (nose, palate, finish, overall)
  - Frequently used tasting notes
  - Recent session activity
- Achievement/badge system
  - 13 achievements across 4 categories (sessions, whiskeys, exploration, hosting)
  - Progress tracking for unearned achievements
  - Visual badges with category-specific icons
  - Achievement summary with completion percentage
- Tabbed interface on public profiles (Stats, Achievements, Notes)

## [78ec1ff] - 2026-01-24

### Added
- Social features
  - Follow/unfollow other users
  - View followers list (`/user/:userId/followers`)
  - View following list (`/user/:userId/following`)
  - Follower and following counts on profiles
- Public profile pages (`/user/:userId`)
  - View any user's public profile
  - Profile privacy toggle (public/private)
  - Private profiles show limited info to non-followers
- Shareable tasting notes
  - Share individual tasting scores to public profile
  - Toggle note visibility from Profile page or Reveal page
  - Public notes display whiskey details, scores, and tasting notes
- New database tables and columns
  - `follows` table for follow relationships
  - `is_profile_public` column on users (default: true)
  - `is_public` column on scores (default: false)
- Social API endpoints (`/api/social/*`)
  - Follow/unfollow endpoints
  - Followers/following list endpoints (paginated)
  - Public profile endpoint with stats
  - Privacy toggle endpoint
  - Public tasting notes endpoint

## [716524c] - 2026-01-24

### Added
- Tasting profile features
  - Bio/tagline (up to 200 characters)
  - Favorite whiskey category (bourbon, rye, scotch, irish, japanese, canadian, other)
  - Experience level indicator (beginner, intermediate, advanced, expert)
- `setUser` action in auth store for updating user state

## [e403a36] - 2026-01-24

### Added
- CLAUDE.md for Claude Code guidance

## [5fcf24b] - 2026-01-24

### Added
- Profile photo upload functionality
  - Supports JPEG, PNG, GIF, and WebP formats (max 5MB)
  - Avatar displayed in header navigation and profile page
  - Automatic cleanup of old avatars when uploading new ones

### Changed
- Header now shows avatar and clickable username linking to profile page

## [00d543e] - 2026-01-24

### Added
- User profile page (`/profile`) for account settings
  - Change display name
  - Change email address (requires password confirmation)
  - Change password (invalidates all refresh tokens for security)
- Profile link in header navigation (click username to access)

## [cbfc54d] - 2026-01-24

### Added
- Email validation on registration (RFC 5322 compliant, blocks disposable emails)

## [797ea73] - 2026-01-24

### Added
- Apache 2.0 License

## [1ad64ae] - 2026-01-24

### Changed
- Updated README with setup instructions and API documentation

## [d37f97b] - 2026-01-24

### Added
- Initial release of Whiskey Canon Blinds
- Session management for blind whiskey tastings
  - Create sessions with 1-6 whiskeys
  - Generate invite codes for participants
  - Real-time WebSocket synchronization
- Guided tasting protocol with phases: pour, nosing, tasting (neat/water), scoring, palate reset
- Weighted scoring system (nose 25%, palate 35%, finish 25%, overall 15%)
- Anti-anchoring design - scores isolated until reveal
- User authentication with JWT (access + refresh + participant tokens)
- Role-based access control (user/admin roles)
- Admin dashboard for user and session management
- Responsive dark theme UI with Tailwind CSS
- Navigation header and footer on all pages

### Technical Stack
- Frontend: React 19, TypeScript, Vite, Zustand, React Router v7
- Backend: Node.js, Express 5, SQLite, Drizzle ORM, Socket.io
- Authentication: JWT with bcrypt password hashing
