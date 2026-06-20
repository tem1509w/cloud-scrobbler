import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getValidSpotifyToken } from "../lib/spotify";
import {
  GetPlaylistsResponse,
  GetDevicesResponse,
  StartPlaybackResponse,
  PausePlaybackResponse,
  SetRepeatModeResponse,
  SetRepeatModeBody,
  StartPlaybackBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
}

function needsReconnect(res: import("express").Response): void {
  res.status(403).json({
    needsReconnect: true,
    message:
      "Spotify playback permissions are missing. Please reconnect your Spotify account to enable playlist control.",
  });
}

router.get("/playback/playlists", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const token = user ? await getValidSpotifyToken(user) : null;
  if (!token) {
    res.status(401).json({ error: "Spotify not connected" });
    return;
  }

  const resp = await spotifyFetch(token, "/me/playlists?limit=50");
  if (resp.status === 403) {
    needsReconnect(res);
    return;
  }
  if (!resp.ok) {
    res.status(502).json({ error: "Spotify API error" });
    return;
  }

  const data = (await resp.json()) as {
    items: {
      id: string;
      name: string;
      uri: string;
      images: { url: string }[];
      tracks: { total: number };
      owner: { display_name: string };
    }[];
  };

  res.json(
    GetPlaylistsResponse.parse(
      data.items.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.images?.[0]?.url ?? null,
        trackCount: p.tracks.total,
        uri: p.uri,
        owner: p.owner?.display_name ?? "",
      }))
    )
  );
});

router.get("/playback/devices", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const token = user ? await getValidSpotifyToken(user) : null;
  if (!token) {
    res.status(401).json({ error: "Spotify not connected" });
    return;
  }

  const resp = await spotifyFetch(token, "/me/player/devices");
  if (resp.status === 403) {
    needsReconnect(res);
    return;
  }
  if (!resp.ok) {
    res.status(502).json({ error: "Spotify API error" });
    return;
  }

  const data = (await resp.json()) as {
    devices: {
      id: string;
      name: string;
      type: string;
      is_active: boolean;
      volume_percent: number | null;
    }[];
  };

  res.json(
    GetDevicesResponse.parse(
      (data.devices ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        type: d.type,
        isActive: d.is_active,
        volumePercent: d.volume_percent ?? null,
      }))
    )
  );
});

router.post("/playback/play", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = StartPlaybackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const token = user ? await getValidSpotifyToken(user) : null;
  if (!token) {
    res.status(401).json({ error: "Spotify not connected" });
    return;
  }

  const { contextUri, deviceId, repeat } = parsed.data;
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";

  const playResp = await spotifyFetch(token, `/me/player/play${query}`, {
    method: "PUT",
    body: JSON.stringify({ context_uri: contextUri }),
  });

  if (playResp.status === 403) {
    needsReconnect(res);
    return;
  }

  // If repeat requested, set it after play starts
  if (repeat && (playResp.ok || playResp.status === 204)) {
    const repeatQuery = deviceId
      ? `?state=context&device_id=${encodeURIComponent(deviceId)}`
      : "?state=context";
    await spotifyFetch(token, `/me/player/repeat${repeatQuery}`, { method: "PUT" });
  }

  res.json(StartPlaybackResponse.parse({ ok: playResp.ok || playResp.status === 204 }));
});

router.post("/playback/pause", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const token = user ? await getValidSpotifyToken(user) : null;
  if (!token) {
    res.status(401).json({ error: "Spotify not connected" });
    return;
  }

  const resp = await spotifyFetch(token, "/me/player/pause", { method: "PUT" });
  if (resp.status === 403) {
    needsReconnect(res);
    return;
  }

  res.json(PausePlaybackResponse.parse({ ok: resp.ok || resp.status === 204 }));
});

router.patch("/playback/repeat", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = SetRepeatModeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  const token = user ? await getValidSpotifyToken(user) : null;
  if (!token) {
    res.status(401).json({ error: "Spotify not connected" });
    return;
  }

  const resp = await spotifyFetch(
    token,
    `/me/player/repeat?state=${encodeURIComponent(parsed.data.state)}`,
    { method: "PUT" }
  );
  if (resp.status === 403) {
    needsReconnect(res);
    return;
  }

  res.json(SetRepeatModeResponse.parse({ ok: resp.ok || resp.status === 204 }));
});

export default router;
