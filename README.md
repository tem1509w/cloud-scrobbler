# Cloud Scrobbler

Cloud-based Spotify-to-Last.fm scrobbling application. Connect your Spotify and Last.fm accounts, automatically scrobble tracks you listen to, and view your listening history and stats.

## Features

- **Auto Scrobble** - Automatically scrobbles tracks to Last.fm based on Spotify playback
- **Live Monitoring** - See what's currently playing with real-time updates
- **Manual Trigger** - Manually trigger scrobble checks
- **History** - View full scrobble history with pagination and album art
- **Analytics** - Top artists, top tracks, and 30-day scrobble activity charts
- **Playback Control** - Control Spotify playback (playlists, devices, repeat)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, Tailwind CSS 4, shadcn/ui, Wouter, React Query |
| Backend | Express 5, express-session (PostgreSQL store) |
| Database | PostgreSQL 16, Drizzle ORM |
| Validation | Zod (v4), drizzle-zod |
| Codegen | Orval (OpenAPI → React Query hooks + Zod schemas) |
| Build | esbuild, pnpm workspaces |

## Prerequisites

- **Node.js** 24+
- **pnpm** 9+
- **PostgreSQL** 16+

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cloud_scrobbler

# Session
SESSION_SECRET=your-random-secret-key

# Spotify (from Spotify Developer Dashboard)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret

# Last.fm (from Last.fm API)
LASTFM_API_KEY=your-lastfm-api-key
LASTFM_SHARED_SECRET=your-lastfm-shared-secret
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Setup database

```bash
# Push schema to database
pnpm --filter @workspace/db run push
```

### 3. Start development servers

Open two terminals:

```bash
# Terminal 1: API Server (port 8080)
pnpm --filter @workspace/api-server run dev
```

```bash
# Terminal 2: Frontend (port 20165)
pnpm --filter @workspace/scrobble run dev
```

### 4. Open the app

- Frontend: `http://localhost:20165`
- API: `http://localhost:8080`

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run typecheck` | Run typecheck across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas |
| `pnpm --filter @workspace/db run push` | Push DB schema changes (dev only) |

## Project Structure

```
cloud-scrobbler/
├── lib/                          # Shared internal packages
│   ├── db/                       # PostgreSQL + Drizzle ORM
│   ├── api-spec/                 # OpenAPI contract (source of truth)
│   ├── api-zod/                  # Generated Zod schemas
│   └── api-client-react/         # Generated React Query hooks
│
├── artifacts/                    # Deployable applications
│   ├── api-server/               # Express 5 backend
│   ├── scrobble/                 # React + Vite frontend
│   └── mockup-sandbox/           # UI prototyping sandbox
│
└── scripts/                      # Utility scripts
```

## Spotify Developer Dashboard Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app (or use existing)
3. Add **Redirect URIs**:
   - Dev: `https://<REPLIT_DEV_DOMAIN>/api/auth/spotify/callback`
   - Production: `https://<your-production-domain>/api/auth/spotify/callback`
4. Copy `Client ID` and `Client Secret` to your `.env` file

## Last.fm API Setup

1. Go to [Last.fm API](https://www.last.fm/api/account/create)
2. Create an API account
3. Copy `API Key` and `Shared Secret` to your `.env` file

## Architecture

- **Session-based auth** - Users identified by express-session cookie stored in PostgreSQL
- **Scrobble threshold** - Track must be 50% complete (or 4 min played) before scrobbling
- **Dedup** - Checks last scrobble within 5 minutes against same Spotify track ID
- **Token refresh** - Spotify tokens auto-refresh 60 seconds before expiry
- **Codegen pipeline** - OpenAPI spec → Orval → Zod schemas + React Query hooks

## License

MIT
