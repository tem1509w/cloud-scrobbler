import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSpotifyAuthUrl,
  exchangeSpotifyCode,
  getSpotifyUserProfile,
  getValidSpotifyToken,
} from "../lib/spotify";
import { getLastfmAuthUrl, getLastfmSession } from "../lib/lastfm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getBaseUrl(req: import("express").Request): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}`;
  return `${req.protocol}://${req.get("host")}`;
}

async function getOrCreateUser(sessionId: string): Promise<import("@workspace/db").User> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.sessionId, sessionId));
  if (existing) return existing;
  const [user] = await db.insert(usersTable).values({ sessionId }).returning();
  return user;
}

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json({
      spotifyConnected: false,
      lastfmConnected: false,
      spotifyUser: null,
      lastfmUser: null,
      scrobblingEnabled: false,
      totalScrobbles: 0,
    });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    req.session.destroy(() => {});
    res.json({
      spotifyConnected: false,
      lastfmConnected: false,
      spotifyUser: null,
      lastfmUser: null,
      scrobblingEnabled: false,
      totalScrobbles: 0,
    });
    return;
  }

  const { scrobblesTable } = await import("@workspace/db");
  const { count } = await import("drizzle-orm");
  const [countRow] = await db
    .select({ value: count() })
    .from(scrobblesTable)
    .where(eq(scrobblesTable.userId, user.id));

  res.json({
    spotifyConnected: !!user.spotifyAccessToken,
    lastfmConnected: !!user.lastfmSessionKey,
    spotifyUser: user.spotifyUserId
      ? {
          id: user.spotifyUserId,
          displayName: user.spotifyDisplayName ?? user.spotifyUserId,
          imageUrl: user.spotifyImageUrl ?? null,
        }
      : null,
    lastfmUser: user.lastfmUsername ? { username: user.lastfmUsername } : null,
    scrobblingEnabled: user.scrobblingEnabled === "true",
    totalScrobbles: Number(countRow?.value ?? 0),
  });
});

// --- Spotify ---
router.get("/auth/spotify/connect", async (req, res): Promise<void> => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.spotifyState = state;

  // Ensure user exists
  const sessionId = req.sessionID;
  const user = await getOrCreateUser(sessionId);
  req.session.userId = user.id;

  const redirectUri = `${getBaseUrl(req)}/api/auth/spotify/callback`;
  const url = getSpotifyAuthUrl(redirectUri, state);
  res.redirect(url);
});

router.get("/auth/spotify/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendBase = getBaseUrl(req);

  if (error || !code) {
    res.redirect(`${frontendBase}/?error=spotify_denied`);
    return;
  }

  if (state !== req.session.spotifyState) {
    res.redirect(`${frontendBase}/?error=spotify_state_mismatch`);
    return;
  }

  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/spotify/callback`;
    const { accessToken, refreshToken, expiresAt } = await exchangeSpotifyCode(code, redirectUri);
    const profile = await getSpotifyUserProfile(accessToken);

    if (!req.session.userId) {
      const user = await getOrCreateUser(req.sessionID);
      req.session.userId = user.id;
    }

    await db
      .update(usersTable)
      .set({
        spotifyUserId: profile.id,
        spotifyDisplayName: profile.displayName,
        spotifyImageUrl: profile.imageUrl ?? null,
        spotifyAccessToken: accessToken,
        spotifyRefreshToken: refreshToken,
        spotifyTokenExpiresAt: expiresAt,
      })
      .where(eq(usersTable.id, req.session.userId!));

    res.redirect(`${frontendBase}/`);
  } catch (err) {
    req.log.error({ err }, "Spotify callback error");
    res.redirect(`${frontendBase}/?error=spotify_auth_failed`);
  }
});

router.post("/auth/disconnect/spotify", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json({ ok: true });
    return;
  }
  await db
    .update(usersTable)
    .set({
      spotifyUserId: null,
      spotifyDisplayName: null,
      spotifyImageUrl: null,
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyTokenExpiresAt: null,
    })
    .where(eq(usersTable.id, req.session.userId));
  res.json({ ok: true });
});

// --- Last.fm ---
router.get("/auth/lastfm/connect", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    const user = await getOrCreateUser(req.sessionID);
    req.session.userId = user.id;
  }
  const callbackUrl = `${getBaseUrl(req)}/api/auth/lastfm/callback`;
  res.redirect(getLastfmAuthUrl(callbackUrl));
});

router.get("/auth/lastfm/callback", async (req, res): Promise<void> => {
  const { token } = req.query as { token?: string };
  const frontendBase = getBaseUrl(req);

  if (!token) {
    res.redirect(`${frontendBase}/?error=lastfm_denied`);
    return;
  }

  try {
    const { key, username } = await getLastfmSession(token);

    if (!req.session.userId) {
      const user = await getOrCreateUser(req.sessionID);
      req.session.userId = user.id;
    }

    await db
      .update(usersTable)
      .set({ lastfmSessionKey: key, lastfmUsername: username })
      .where(eq(usersTable.id, req.session.userId!));

    res.redirect(`${frontendBase}/`);
  } catch (err) {
    req.log.error({ err }, "Last.fm callback error");
    res.redirect(`${frontendBase}/?error=lastfm_auth_failed`);
  }
});

router.post("/auth/disconnect/lastfm", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json({ ok: true });
    return;
  }
  await db
    .update(usersTable)
    .set({ lastfmSessionKey: null, lastfmUsername: null })
    .where(eq(usersTable.id, req.session.userId));
  res.json({ ok: true });
});

export default router;
