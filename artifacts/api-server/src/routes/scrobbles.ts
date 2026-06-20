import { Router, type IRouter } from "express";
import { db, usersTable, scrobblesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { getValidSpotifyToken, getSpotifyCurrentlyPlaying } from "../lib/spotify";
import { scrobbleTrack, updateNowPlaying } from "../lib/lastfm";
import {
  GetScrobblesQueryParams,
  GetScrobblesResponse,
  GetNowPlayingResponse,
  TriggerScrobbleResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scrobbles", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json({ scrobbles: [], total: 0 });
    return;
  }

  const query = GetScrobblesQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 50) : 50;
  const offset = query.success ? (query.data.offset ?? 0) : 0;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(scrobblesTable)
      .where(eq(scrobblesTable.userId, req.session.userId))
      .orderBy(desc(scrobblesTable.scrobbledAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(scrobblesTable)
      .where(eq(scrobblesTable.userId, req.session.userId)),
  ]);

  res.json(
    GetScrobblesResponse.parse({
      scrobbles: rows.map((r) => ({
        id: r.id,
        trackName: r.trackName,
        artistName: r.artistName,
        albumName: r.albumName,
        albumArt: r.albumArt ?? null,
        spotifyTrackId: r.spotifyTrackId,
        durationMs: r.durationMs ?? null,
        scrobbledAt: r.scrobbledAt.toISOString(),
      })),
      total: Number(countRows[0]?.value ?? 0),
    })
  );
});

router.get("/scrobbles/now-playing", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(GetNowPlayingResponse.parse({ isPlaying: false, track: null }));
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user?.spotifyAccessToken) {
    res.json(GetNowPlayingResponse.parse({ isPlaying: false, track: null }));
    return;
  }

  const token = await getValidSpotifyToken(user);
  if (!token) {
    res.json(GetNowPlayingResponse.parse({ isPlaying: false, track: null }));
    return;
  }

  const np = await getSpotifyCurrentlyPlaying(token);
  if (!np || !np.isPlaying || !np.trackName) {
    res.json(GetNowPlayingResponse.parse({ isPlaying: false, track: null }));
    return;
  }

  res.json(
    GetNowPlayingResponse.parse({
      isPlaying: true,
      track: {
        trackName: np.trackName,
        artistName: np.artistName ?? "",
        albumName: np.albumName ?? "",
        albumArt: np.albumArt ?? null,
        spotifyTrackId: np.spotifyTrackId ?? "",
        durationMs: np.durationMs ?? 0,
        progressMs: np.progressMs ?? 0,
      },
    })
  );
});

router.post("/scrobbles/trigger", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(TriggerScrobbleResponse.parse({ scrobbled: false, message: "Not authenticated", track: null }));
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));

  if (!user?.spotifyAccessToken) {
    res.json(TriggerScrobbleResponse.parse({ scrobbled: false, message: "Spotify not connected", track: null }));
    return;
  }

  if (!user?.lastfmSessionKey) {
    res.json(TriggerScrobbleResponse.parse({ scrobbled: false, message: "Last.fm not connected", track: null }));
    return;
  }

  const token = await getValidSpotifyToken(user);
  if (!token) {
    res.json(TriggerScrobbleResponse.parse({ scrobbled: false, message: "Spotify token invalid", track: null }));
    return;
  }

  const np = await getSpotifyCurrentlyPlaying(token);
  if (!np?.isPlaying || !np.trackName) {
    res.json(TriggerScrobbleResponse.parse({ scrobbled: false, message: "Nothing playing on Spotify", track: null }));
    return;
  }

  // Only scrobble if at least 50% of track played (or 4 minutes, whichever is lower)
  const progress = np.progressMs ?? 0;
  const duration = np.durationMs ?? 0;
  const threshold = Math.min(duration * 0.5, 4 * 60 * 1000);

  if (duration > 0 && progress < threshold) {
    // Still update now playing on Last.fm even if not scrobbling yet
    await updateNowPlaying(user.lastfmSessionKey, {
      trackName: np.trackName,
      artistName: np.artistName ?? "",
      albumName: np.albumName ?? "",
      durationMs: np.durationMs,
    });
    res.json(
      TriggerScrobbleResponse.parse({
        scrobbled: false,
        message: `Track needs more play time (${Math.round(progress / 1000)}s / ${Math.round(threshold / 1000)}s needed)`,
        track: { trackName: np.trackName, artistName: np.artistName ?? "" },
      })
    );
    return;
  }

  // Check if already scrobbled this track recently (within last 5 minutes)
  const recentScrobbles = await db
    .select()
    .from(scrobblesTable)
    .where(eq(scrobblesTable.userId, user.id))
    .orderBy(desc(scrobblesTable.scrobbledAt))
    .limit(1);

  const lastScrobble = recentScrobbles[0];
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (
    lastScrobble &&
    lastScrobble.spotifyTrackId === np.spotifyTrackId &&
    lastScrobble.scrobbledAt > fiveMinutesAgo
  ) {
    res.json(
      TriggerScrobbleResponse.parse({
        scrobbled: false,
        message: "Track already scrobbled recently",
        track: { trackName: np.trackName, artistName: np.artistName ?? "" },
      })
    );
    return;
  }

  const scrobbled = await scrobbleTrack(user.lastfmSessionKey, {
    trackName: np.trackName,
    artistName: np.artistName ?? "",
    albumName: np.albumName ?? "",
    timestamp: Date.now(),
    durationMs: np.durationMs,
  });

  if (scrobbled) {
    await db.insert(scrobblesTable).values({
      userId: user.id,
      trackName: np.trackName,
      artistName: np.artistName ?? "",
      albumName: np.albumName ?? "",
      albumArt: np.albumArt ?? null,
      spotifyTrackId: np.spotifyTrackId ?? "",
      durationMs: np.durationMs ?? null,
    });
  }

  res.json(
    TriggerScrobbleResponse.parse({
      scrobbled,
      message: scrobbled ? "Scrobbled successfully" : "Last.fm scrobble failed",
      track: { trackName: np.trackName, artistName: np.artistName ?? "" },
    })
  );
});

export default router;
