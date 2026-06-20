import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const PgSession = ConnectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  // Save session immediately so the state param survives the OAuth round-trip
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    // Replit always serves over HTTPS — secure cookies work in both dev & prod
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
});

declare module "express-session" {
  interface SessionData {
    userId: number;
    spotifyState?: string;
    lastfmToken?: string;
  }
}
