# Whiskey Canon Blinds

A multi-user web application for hosting and participating in blind whiskey tasting sessions. Score independently, reveal together.

## Features

- **Session Management** - Create tasting sessions with 1-6 whiskeys, invite participants via unique codes
- **Guided Tasting Protocol** - Structured phases: pour, nosing, tasting (neat), tasting (with water), scoring, palate reset
- **Anti-Anchoring Design** - Scores are isolated until reveal; participants cannot see others' ratings
- **Real-time Sync** - WebSocket-powered updates keep all participants synchronized
- **Weighted Scoring** - Score nose (25%), palate (35%), finish (25%), and overall impression (15%)
- **Dramatic Reveal** - Moderator controls when identities and scores are unveiled
- **Admin Dashboard** - Role-based access control for user and session management

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for development and builds
- Tailwind CSS v4 for styling
- Zustand for state management
- React Router v7 for navigation
- React Hook Form + Zod for form validation
- Socket.io Client for real-time updates

### Backend
- Node.js with Express 5
- SQLite with Drizzle ORM
- Socket.io for WebSocket communication
- JWT authentication (access + refresh + participant tokens)
- bcrypt for password hashing

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whiskey-canon-blinds.git
cd whiskey-canon-blinds
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
PARTICIPANT_TOKEN_SECRET=your-participant-secret-here
```

4. Start the development server:
```bash
npm run dev
```

This starts both the frontend (http://localhost:5173) and backend (http://localhost:3001) concurrently.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both client and server in development mode |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Express server with hot reload |
| `npm run build` | Build the frontend for production |
| `npm run build:server` | Compile the server TypeScript |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build |

## Project Structure

```
whiskey-canon-blinds/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── layout/         # Header, Footer, Layout
│   │   ├── tasting/        # Tasting-specific components
│   │   └── ui/             # Reusable UI components
│   ├── pages/              # Page components
│   ├── services/           # API client
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── server/                 # Backend source
│   └── src/
│       ├── db/             # Database schema and setup
│       ├── middleware/     # Express middleware
│       └── routes/         # API routes
└── public/                 # Static assets
```

## User Roles

### Moderator (Host)
- Create and configure tasting sessions
- Define the flight (whiskeys to be tasted)
- Generate invite codes for participants
- Control session progression (start, pause, advance phases)
- Initiate the reveal when all scores are locked
- View aggregated results

### Participant
- Join sessions via invite code
- Follow the guided tasting protocol
- Record notes and scores independently
- Cannot see other participants' scores until reveal
- View final results after reveal

### Admin
- Manage all users (view, update roles, delete)
- Manage all sessions (view, delete)
- Access admin dashboard at `/admin`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Sessions
- `POST /api/sessions` - Create session (auth required)
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/join` - Join session by code
- `POST /api/sessions/:id/start` - Start session (moderator)
- `POST /api/sessions/:id/advance` - Advance phase (moderator)
- `POST /api/sessions/:id/reveal` - Initiate reveal (moderator)
- `GET /api/sessions/:id/results` - Get results

### Scores
- `POST /api/scores` - Submit score (participant)
- `POST /api/scores/ready` - Mark ready status

### Admin
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id/role` - Update user role
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/sessions` - List all sessions
- `DELETE /api/admin/sessions/:id` - Delete session

## WebSocket Events

### Client to Server
- `join:session` - Join a session room
- `participant:ready` - Mark participant as ready

### Server to Client
- `participant:joined` - New participant joined
- `participant:ready` - Participant marked ready
- `session:started` - Session has begun
- `phase:advanced` - Phase/whiskey changed
- `session:revealed` - Reveal initiated

## Scoring System

| Category | Weight | Description |
|----------|--------|-------------|
| Nose | 25% | Aroma complexity, appeal, intensity |
| Palate | 35% | Flavor profile, balance, mouthfeel |
| Finish | 25% | Length, evolution, pleasantness |
| Overall | 15% | Subjective enjoyment |

Scores are on a 1-10 scale. The total score is a weighted average.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

*Taste responsibly. Score honestly.*
