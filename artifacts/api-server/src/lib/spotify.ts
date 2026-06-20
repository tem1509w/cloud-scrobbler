import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { User } from "@workspace/db";
import { logger } from "./logger";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export function getSpotifyAuthUrl(redirectUri: string, state: string): string {
  const scopes = ["user-read-currently-playing", "user-read-playback-state"].join(" ");
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: scopes,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Spotify token exchange failed: ${txt}`);
  }
  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

export async function refreshSpotifyToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!resp.ok) {
    throw new Error("Failed to refresh Spotify token");
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function getValidSpotifyToken(user: User): Promise<string | null> {
  if (!user.spotifyAccessToken || !user.spotifyRefreshToken) return null;

  const now = new Date();
  const expiresAt = user.spotifyTokenExpiresAt;

  if (expiresAt && expiresAt > new Date(now.getTime() + 60_000)) {
    return user.spotifyAccessToken;
  }

  try {
    const { accessToken, expiresAt: newExpiry } = await refreshSpotifyToken(user.spotifyRefreshToken);
    await db
      .update(usersTable)
      .set({ spotifyAccessToken: accessToken, spotifyTokenExpiresAt: newExpiry })
      .where(eq(usersTable.id, user.id));
    return accessToken;
  } catch (err) {
    logger.error({ err }, "Failed to refresh Spotify token");
    return null;
  }
}

export async function getSpotifyCurrentlyPlaying(accessToken: string): Promise<{
  isPlaying: boolean;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
  spotifyTrackId?: string;
  durationMs?: number;
  progressMs?: number;
} | null> {
  const resp = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 204 || resp.status === 404) {
    return { isPlaying: false };
  }

  if (!resp.ok) {
    throw new Error(`Spotify API error: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    is_playing: boolean;
    progress_ms: number;
    item?: {
      id: string;
      name: string;
      duration_ms: number;
      artists: { name: string }[];
      album: {
        name: string;
        images: { url: string }[];
      };
    };
  };

  if (!data.item) {
    return { isPlaying: false };
  }

  return {
    isPlaying: data.is_playing,
    trackName: data.item.name,
    artistName: data.item.artists.map((a) => a.name).join(", "),
    albumName: data.item.album.name,
    albumArt: data.item.album.images[0]?.url ?? undefined,
    spotifyTrackId: data.item.id,
    durationMs: data.item.duration_ms,
    progressMs: data.progress_ms,
  };
}

export async function getSpotifyUserProfile(accessToken: string): Promise<{
  id: string;
  displayName: string;
  imageUrl?: string;
}> {
  const resp = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error("Failed to get Spotify profile");
  const data = (await resp.json()) as {
    id: string;
    display_name: string;
    images: { url: string }[];
  };
  return {
    id: data.id,
    displayName: data.display_name || data.id,
    imageUrl: data.images?.[0]?.url,
  };
}
