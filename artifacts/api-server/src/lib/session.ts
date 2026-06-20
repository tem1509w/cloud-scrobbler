import session from "express-session";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

export const sessionMiddleware = session({
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
