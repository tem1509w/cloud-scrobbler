# Scrobble

A cloud Spotify-to-Last.fm scrobbling app. Connects your Spotify and Last.fm accounts, automatically scrobbles tracks you listen to, and shows your listening history and stats.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/scrobble run dev` — run the frontend (port 20165)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + Wouter + React Query
- API: Express 5 + express-session
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/users.ts` — users table (Spotify + Last.fm tokens)
- `lib/db/src/schema/scrobbles.ts` — scrobbles table
- `artifacts/api-server/src/routes/auth.ts` — Spotify & Last.fm OAuth + session
- `artifacts/api-server/src/routes/scrobbles.ts` — now-playing, history, trigger
- `artifacts/api-server/src/routes/stats.ts` — top artists, top tracks, per-day
- `artifacts/api-server/src/lib/spotify.ts` — Spotify API client + token refresh
- `artifacts/api-server/src/lib/lastfm.ts` — Last.fm scrobble API (md5-signed)
- `artifacts/scrobble/src/` — React frontend (Control Room, History, Analytics)

## Architecture decisions

- Session-based auth: users are identified by an `express-session` cookie, stored server-side. No JWT.
- Scrobble threshold: follows Last.fm spec — track must be 50% complete (or 4 min played) before scrobbling.
- Dedup: we check the last scrobble within 5 minutes against the same Spotify track ID to avoid double-scrobbles.
- Last.fm auth uses web auth flow (token → session key). The session key is permanent — no refresh needed.
- Spotify tokens auto-refresh 60 seconds before expiry in `getValidSpotifyToken()`.

## Product

- Connect Spotify + Last.fm accounts via OAuth
- See what's currently playing on Spotify (polls every 10s)
- Manually trigger a scrobble check
- View full scrobble history (paginated, with album art)
- Analytics: top artists, top tracks, 30-day scrobble activity chart

## Gotchas

- **Spotify redirect URI**: You must add your app domain to the Spotify Developer Dashboard allowed redirect URIs: `https://<your-domain>/api/auth/spotify/callback`
  - Dev: `https://<REPLIT_DEV_DOMAIN>/api/auth/spotify/callback`
  - Production: `https://<your-replit-app-domain>/api/auth/spotify/callback`
- **Last.fm scrobble signing**: uses HMAC-MD5 with `LASTFM_SHARED_SECRET`. Parameter order matters.
- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` after changing `lib/db/src/schema/`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
