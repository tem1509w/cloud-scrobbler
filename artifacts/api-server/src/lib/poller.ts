import { db, usersTable, scrobblesTable } from "@workspace/db";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { getValidSpotifyToken, getSpotifyCurrentlyPlaying } from "./spotify";
import { scrobbleTrack, updateNowPlaying } from "./lastfm";
import { logger } from "./logger";
import type { User } from "@workspace/db";

const POLL_INTERVAL_MS = 30_000;

interface TrackState {
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  firstSeenAt: Date;
  scrobbled: boolean;
  nowPlayingUpdatedAt: Date | null;
}

// In-memory state per userId
const userTrackState = new Map<number, TrackState>();

async function pollUser(user: User): Promise<void> {
  try {
    const token = await getValidSpotifyToken(user);
    if (!token) return;

    const np = await getSpotifyCurrentlyPlaying(token);

    if (!np || !np.isPlaying || !np.spotifyTrackId || !np.trackName) {
      // Nothing playing — clear state
      userTrackState.delete(user.id);
      return;
    }

    const existing = userTrackState.get(user.id);
    const now = new Date();

    if (existing && existing.spotifyTrackId === np.spotifyTrackId) {
      // Same track still playing
      const elapsed = now.getTime() - existing.firstSeenAt.getTime();
      const duration = np.durationMs ?? existing.durationMs;
      const threshold = duration > 0 ? Math.min(duration * 0.5, 4 * 60 * 1000) : 60_000;

      // Update now playing on Last.fm every 60s
      const shouldUpdateNp =
        !existing.nowPlayingUpdatedAt ||
        now.getTime() - existing.nowPlayingUpdatedAt.getTime() > 60_000;

      if (shouldUpdateNp && user.lastfmSessionKey) {
        await updateNowPlaying(user.lastfmSessionKey, {
          trackName: existing.trackName,
          artistName: existing.artistName,
          albumName: existing.albumName,
          durationMs: existing.durationMs,
        });
        existing.nowPlayingUpdatedAt = now;
      }

      if (!existing.scrobbled && elapsed >= threshold) {
        // Dedup: check last scrobble
        const recentRows = await db
          .select()
          .from(scrobblesTable)
          .where(eq(scrobblesTable.userId, user.id))
          .orderBy(desc(scrobblesTable.scrobbledAt))
          .limit(1);

        const last = recentRows[0];
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        if (last && last.spotifyTrackId === np.spotifyTrackId && last.scrobbledAt > fiveMinutesAgo) {
          existing.scrobbled = true;
          logger.debug({ userId: user.id, track: existing.trackName }, "Already scrobbled recently, skipping");
          return;
        }

        if (!user.lastfmSessionKey) return;

        const ok = await scrobbleTrack(user.lastfmSessionKey, {
          trackName: existing.trackName,
          artistName: existing.artistName,
          albumName: existing.albumName,
          timestamp: now.getTime(),
          durationMs: existing.durationMs,
        });

        if (ok) {
          await db.insert(scrobblesTable).values({
            userId: user.id,
            trackName: existing.trackName,
            artistName: existing.artistName,
            albumName: existing.albumName,
            albumArt: existing.albumArt,
            spotifyTrackId: existing.spotifyTrackId,
            durationMs: existing.durationMs,
          });
          existing.scrobbled = true;
          logger.info(
            { userId: user.id, track: existing.trackName, artist: existing.artistName },
            "Auto-scrobbled track"
          );
        }
      }
    } else {
      // New track detected
      const newState: TrackState = {
        spotifyTrackId: np.spotifyTrackId,
        trackName: np.trackName,
        artistName: np.artistName ?? "",
        albumName: np.albumName ?? "",
        albumArt: np.albumArt ?? null,
        durationMs: np.durationMs ?? 0,
        firstSeenAt: now,
        scrobbled: false,
        nowPlayingUpdatedAt: null,
      };
      userTrackState.set(user.id, newState);

      // Immediately update now-playing on Last.fm for new track
      if (user.lastfmSessionKey) {
        await updateNowPlaying(user.lastfmSessionKey, {
          trackName: newState.trackName,
          artistName: newState.artistName,
          albumName: newState.albumName,
          durationMs: newState.durationMs,
        });
        newState.nowPlayingUpdatedAt = now;
      }

      logger.debug({ userId: user.id, track: newState.trackName }, "New track detected");
    }
  } catch (err) {
    logger.warn({ err, userId: user.id }, "Error polling user");
  }
}

async function runPoll(): Promise<void> {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(
        and(
          isNotNull(usersTable.spotifyAccessToken),
          isNotNull(usersTable.lastfmSessionKey),
          eq(usersTable.scrobblingEnabled, "true")
        )
      );

    if (users.length === 0) return;

    logger.debug({ userCount: users.length }, "Polling active users");
    await Promise.allSettled(users.map(pollUser));
  } catch (err) {
    logger.error({ err }, "Polling cycle error");
  }
}

export function startPoller(): void {
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Auto-scrobble poller started");
  // Run immediately on start, then every interval
  void runPoll();
  setInterval(() => void runPoll(), POLL_INTERVAL_MS);
}
