import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const scrobblesTable = pgTable("scrobbles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  trackName: text("track_name").notNull(),
  artistName: text("artist_name").notNull(),
  albumName: text("album_name").notNull().default(""),
  albumArt: text("album_art"),
  spotifyTrackId: text("spotify_track_id").notNull(),
  durationMs: integer("duration_ms"),
  scrobbledAt: timestamp("scrobbled_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Scrobble = typeof scrobblesTable.$inferSelect;
export type InsertScrobble = typeof scrobblesTable.$inferInsert;
