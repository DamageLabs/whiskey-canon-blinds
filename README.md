# Whiskey Canon Blinds

A web application for hosting blind whiskey tasting sessions. Eliminate bias, taste objectively, and discover your true preferences.

## What is Blind Tasting?

Blind tasting removes the influence of labels, prices, and reputations. Participants evaluate whiskeys purely on their sensory qualities—nose, palate, and finish—without knowing what they're drinking. This reveals genuine preferences and often produces surprising results.

## Screenshots

### Home Page
![Home Page](screenshots/home-page.png)

Start a new tasting session or join an existing one with an invite code.

### Tasting Protocol Guide
![Tasting Protocol Guide](screenshots/tasting-protocol-guide-page.png)

Built-in guide covering the complete tasting protocol, scoring system, and anti-anchoring rules.

## Key Features

### Session Management

**For Hosts:**
- **Create Sessions** - Set up flights with 1-6 whiskeys, define themes, and set max participants
- **Session Templates** - Save and reuse session configurations for recurring tastings
- **Guided Protocol** - Structured phases: pour, nose, palate (neat), palate (with water), score, palate reset
- **Control the Flow** - Advance participants through each phase at your pace
- **Pause/Resume** - Temporarily pause sessions and resume when ready
- **Dramatic Reveal** - Unveil identities and scores together for maximum impact
- **Export Results** - Download results as CSV or PDF
- **Duplicate Sessions** - Copy session settings to quickly set up similar tastings
- **Email Invites** - Send invitation emails directly from the app

**For Participants:**
- **Join Easily** - Enter a session with just an invite code
- **Score Independently** - Your ratings are private until the reveal
- **Tasting Notes** - Record detailed notes for each whiskey
- **Real-time Comments** - Discuss with other participants during tasting
- **See Results** - Compare your scores against the group after reveal

### Analytics & Insights

- **Personal Analytics** - Track your scoring trends over time
- **Score Distribution** - Visualize how you rate across the 1-10 scale
- **Category Breakdown** - See your average scores for nose, palate, finish, overall
- **Session History** - Review past sessions with group comparison
- **Radar Charts** - Visual representation of your scoring patterns

### Leaderboards & Rankings

- **Global Rankings** - See top tasters across all sessions
- **Time Periods** - Filter by all-time, monthly, or weekly
- **Personal Rank** - Track your position on the leaderboard
- **Points System** - Earn points based on participation and accuracy

### Tasting Notes Library

- **Personal Collection** - Save and organize your tasting notes
- **Import from Sessions** - Automatically import notes from completed tastings
- **Search & Filter** - Find notes by whiskey name, category, or tags
- **Tag System** - Organize notes with custom tags
- **Public/Private** - Choose which notes to share on your profile

### Social Features

- **Follow Users** - Connect with fellow whiskey enthusiasts
- **Public Profiles** - Share your tasting history and achievements
- **Direct Messaging** - Private conversations with other users
- **Activity Feed** - See what people you follow are tasting

### Achievements & Gamification

- **Badge System** - Earn badges for milestones and accomplishments
- **Achievement Categories** - Sessions, whiskeys, exploration, hosting, social
- **Progress Tracking** - See how close you are to earning each badge
- **Points & Ranks** - Accumulate achievement points
- **Streaks** - Track consecutive days/weeks of tasting activity

### Notifications

- **Push Notifications** - Get notified when sessions start, invites arrive, etc.
- **Customizable Preferences** - Choose which notifications you receive
- **In-App Notifications** - See updates without leaving the app

### Anti-Anchoring Design

Scores are completely isolated until the moderator initiates the reveal. Participants cannot see others' ratings, comments, or even whether they've finished scoring. This prevents groupthink and ensures honest evaluations.

## Scoring System

| Category | Weight | What to Evaluate |
|----------|--------|------------------|
| Nose | 25% | Aroma complexity, appeal, intensity |
| Palate | 35% | Flavor profile, balance, mouthfeel |
| Finish | 25% | Length, evolution, pleasantness |
| Overall | 15% | Personal enjoyment |

Scores use a 1-10 scale. The total is a weighted average.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Recharts
- **Backend**: Node.js, Express 5, SQLite, Drizzle ORM
- **Real-time**: Socket.io for live synchronization
- **Auth**: JWT with refresh tokens
- **Email**: Resend for transactional emails
- **PDF**: PDFKit for server-side PDF generation
- **PWA**: Offline support with service worker

## Security

The application implements comprehensive security measures:

- **JWT Authentication** - Secure token-based auth with required secret validation at startup
- **Short-lived Tokens** - Access tokens expire in 15 minutes, with 7-day refresh tokens
- **CSRF Protection** - State-changing requests protected via csrf-csrf package
- **Rate Limiting** - Protection against brute force attacks (5 requests/15 min for login/register)
- **Security Headers** - Helmet.js with CSP, HSTS, frame-guard, and referrer policies
- **Password Requirements** - Minimum 12 characters with uppercase, lowercase, and numbers
- **Cryptographic RNG** - Verification codes and invite codes use Node.js crypto module
- **Password Hashing** - bcrypt with cost factor 12
- **Audit Logging** - Security-sensitive events are logged for review
- **Email Verification** - Required for new accounts

## Getting Started

See [docs.md](docs.md) for installation instructions, API documentation, and project structure.

```bash
# Quick start
git clone https://github.com/fusion94/whiskey-canon-blinds.git
cd whiskey-canon-blinds
npm install

# Configure environment (required)
cp .env.example .env
# Generate a secure JWT secret:
openssl rand -base64 32
# Add the generated secret to .env as JWT_SECRET

# Seed the database with sample data (optional)
npm run db:seed

npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:client` | Start only the Vite frontend (port 5173) |
| `npm run dev:server` | Start only the Express backend (port 3001) |
| `npm run build` | Build frontend for production |
| `npm run build:server` | Build server TypeScript |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:integration` | Run integration tests |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:reset` | Reset database and reseed |
| `npm run lint` | Run ESLint |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for signing JWTs. Generate with `openssl rand -base64 32` |
| `PORT` | No | Server port (default: 3001) |
| `CLIENT_URL` | No | Frontend URL for CORS (default: http://localhost:5173) |
| `RESEND_API_KEY` | No | Resend API key for sending emails |
| `FROM_EMAIL` | No | Sender email address |
| `VAPID_PUBLIC_KEY` | No | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | No | VAPID private key for push notifications |

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions including:
- GCP VM setup with Nginx reverse proxy
- SSL/TLS configuration
- Production environment setup
- Database management

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

*Taste responsibly. Score honestly.*
