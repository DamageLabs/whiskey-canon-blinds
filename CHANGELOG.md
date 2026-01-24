# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- User profile page (`/profile`) for account settings
  - Change display name
  - Change email address (requires password confirmation)
  - Change password (invalidates all refresh tokens for security)
  - Upload, change, or remove profile photo
- Profile link in header navigation (click username to access)
- Profile photo upload functionality
  - Supports JPEG, PNG, GIF, and WebP formats (max 5MB)
  - Avatar displayed in header navigation and profile page
  - Automatic cleanup of old avatars when uploading new ones
- `setUser` action in auth store for updating user state

### Changed
- Header now shows avatar and clickable username linking to profile page

## [0.1.0] - 2026-01-24

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
- Email validation on registration (RFC 5322 compliant, blocks disposable emails)
- Responsive dark theme UI with Tailwind CSS
- Navigation header and footer on all pages

### Technical Stack
- Frontend: React 19, TypeScript, Vite, Zustand, React Router v7
- Backend: Node.js, Express 5, SQLite, Drizzle ORM, Socket.io
- Authentication: JWT with bcrypt password hashing

### Documentation
- README.md with setup instructions and API documentation
- Apache 2.0 License
