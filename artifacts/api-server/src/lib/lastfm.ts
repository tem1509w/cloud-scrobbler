import crypto from "crypto";
import { logger } from "./logger";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY!;
const LASTFM_SHARED_SECRET = process.env.LASTFM_SHARED_SECRET!;
const LASTFM_API_BASE = "https://ws.audioscrobbler.com/2.0/";

function sign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "format")
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return crypto.createHash("md5").update(sorted + LASTFM_SHARED_SECRET, "utf8").digest("hex");
}

export function getLastfmAuthUrl(callbackUrl: string): string {
  return `https://www.last.fm/api/auth/?api_key=${LASTFM_API_KEY}&cb=${encodeURIComponent(callbackUrl)}`;
}

export async function getLastfmSession(token: string): Promise<{ key: string; username: string }> {
  const params: Record<string, string> = {
    api_key: LASTFM_API_KEY,
    method: "auth.getSession",
    token,
  };
  const sig = sign(params);
  const url = new URL(LASTFM_API_BASE);
  url.searchParams.set("method", "auth.getSession");
  url.searchParams.set("api_key", LASTFM_API_KEY);
  url.searchParams.set("token", token);
  url.searchParams.set("api_sig", sig);
  url.searchParams.set("format", "json");

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error("Failed to get Last.fm session");
  const data = (await resp.json()) as {
    session?: { key: string; name: string };
    error?: number;
    message?: string;
  };
  if (data.error) throw new Error(`Last.fm error: ${data.message}`);
  return { key: data.session!.key, username: data.session!.name };
}

export async function scrobbleTrack(
  sessionKey: string,
  track: {
    trackName: string;
    artistName: string;
    albumName: string;
    timestamp: number;
    durationMs?: number;
  }
): Promise<boolean> {
  const params: Record<string, string> = {
    api_key: LASTFM_API_KEY,
    artist: track.artistName,
    method: "track.scrobble",
    sk: sessionKey,
    timestamp: String(Math.floor(track.timestamp / 1000)),
    track: track.trackName,
  };
  if (track.albumName) params.album = track.albumName;
  if (track.durationMs) params.duration = String(Math.floor(track.durationMs / 1000));

  const sig = sign(params);

  const body = new URLSearchParams({ ...params, api_sig: sig, format: "json" });
  const resp = await fetch(LASTFM_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) return false;
  const data = (await resp.json()) as { scrobbles?: { "@attr"?: { accepted?: number } } };
  return (data.scrobbles?.["@attr"]?.accepted ?? 0) > 0;
}

export async function updateNowPlaying(
  sessionKey: string,
  track: {
    trackName: string;
    artistName: string;
    albumName?: string;
    durationMs?: number;
  }
): Promise<void> {
  try {
    const params: Record<string, string> = {
      api_key: LASTFM_API_KEY,
      artist: track.artistName,
      method: "track.updateNowPlaying",
      sk: sessionKey,
      track: track.trackName,
    };
    if (track.albumName) params.album = track.albumName;
    if (track.durationMs) params.duration = String(Math.floor(track.durationMs / 1000));

    const sig = sign(params);
    const body = new URLSearchParams({ ...params, api_sig: sig, format: "json" });
    const resp = await fetch(LASTFM_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status, track: track.trackName }, "Failed to update now playing on Last.fm");
    }
  } catch (err) {
    logger.warn({ err, track: track.trackName }, "Error updating now playing on Last.fm");
  }
}
