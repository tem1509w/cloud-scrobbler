import { Router, type IRouter } from "express";
import { db, usersTable, scrobblesTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import {
  GetStatsSummaryResponse,
  GetTopArtistsResponse,
  GetTopTracksResponse,
  GetScrobblesPerDayResponse,
  GetTopArtistsQueryParams,
  GetTopTracksQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats/summary", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(
      GetStatsSummaryResponse.parse({
        totalScrobbles: 0,
        uniqueArtists: 0,
        uniqueTracks: 0,
        scrobblingEnabled: false,
        todayCount: 0,
        thisWeekCount: 0,
      })
    );
    return;
  }

  const userId = req.session.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.json(
      GetStatsSummaryResponse.parse({
        totalScrobbles: 0,
        uniqueArtists: 0,
        uniqueTracks: 0,
        scrobblingEnabled: false,
        todayCount: 0,
        thisWeekCount: 0,
      })
    );
    return;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [totalRow, todayRow, weekRow, artistRow, trackRow] = await Promise.all([
    db.select({ value: count() }).from(scrobblesTable).where(eq(scrobblesTable.userId, userId)),
    db
      .select({ value: count() })
      .from(scrobblesTable)
      .where(
        sql`${scrobblesTable.userId} = ${userId} AND ${scrobblesTable.scrobbledAt} >= ${todayStart.toISOString()}`
      ),
    db
      .select({ value: count() })
      .from(scrobblesTable)
      .where(
        sql`${scrobblesTable.userId} = ${userId} AND ${scrobblesTable.scrobbledAt} >= ${weekStart.toISOString()}`
      ),
    db
      .select({ value: sql<number>`COUNT(DISTINCT ${scrobblesTable.artistName})` })
      .from(scrobblesTable)
      .where(eq(scrobblesTable.userId, userId)),
    db
      .select({ value: sql<number>`COUNT(DISTINCT ${scrobblesTable.spotifyTrackId})` })
      .from(scrobblesTable)
      .where(eq(scrobblesTable.userId, userId)),
  ]);

  res.json(
    GetStatsSummaryResponse.parse({
      totalScrobbles: Number(totalRow[0]?.value ?? 0),
      uniqueArtists: Number(artistRow[0]?.value ?? 0),
      uniqueTracks: Number(trackRow[0]?.value ?? 0),
      scrobblingEnabled: user.scrobblingEnabled === "true",
      todayCount: Number(todayRow[0]?.value ?? 0),
      thisWeekCount: Number(weekRow[0]?.value ?? 0),
    })
  );
});

router.get("/stats/top-artists", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(GetTopArtistsResponse.parse([]));
    return;
  }

  const query = GetTopArtistsQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 10) : 10;

  const rows = await db
    .select({
      artistName: scrobblesTable.artistName,
      count: count(),
    })
    .from(scrobblesTable)
    .where(eq(scrobblesTable.userId, req.session.userId))
    .groupBy(scrobblesTable.artistName)
    .orderBy(desc(count()))
    .limit(limit);

  res.json(GetTopArtistsResponse.parse(rows.map((r) => ({ artistName: r.artistName, count: Number(r.count) }))));
});

router.get("/stats/top-tracks", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(GetTopTracksResponse.parse([]));
    return;
  }

  const query = GetTopTracksQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 10) : 10;

  const rows = await db
    .select({
      trackName: scrobblesTable.trackName,
      artistName: scrobblesTable.artistName,
      albumArt: sql<string | null>`MAX(${scrobblesTable.albumArt})`,
      count: count(),
    })
    .from(scrobblesTable)
    .where(eq(scrobblesTable.userId, req.session.userId))
    .groupBy(scrobblesTable.trackName, scrobblesTable.artistName)
    .orderBy(desc(count()))
    .limit(limit);

  res.json(
    GetTopTracksResponse.parse(
      rows.map((r) => ({
        trackName: r.trackName,
        artistName: r.artistName,
        albumArt: r.albumArt ?? null,
        count: Number(r.count),
      }))
    )
  );
});

router.get("/stats/scrobbles-per-day", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.json(GetScrobblesPerDayResponse.parse([]));
    return;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      date: sql<string>`DATE(${scrobblesTable.scrobbledAt} AT TIME ZONE 'UTC')`,
      count: count(),
    })
    .from(scrobblesTable)
    .where(
      sql`${scrobblesTable.userId} = ${req.session.userId} AND ${scrobblesTable.scrobbledAt} >= ${thirtyDaysAgo.toISOString()}`
    )
    .groupBy(sql`DATE(${scrobblesTable.scrobbledAt} AT TIME ZONE 'UTC')`)
    .orderBy(sql`DATE(${scrobblesTable.scrobbledAt} AT TIME ZONE 'UTC')`);

  res.json(GetScrobblesPerDayResponse.parse(rows.map((r) => ({ date: r.date, count: Number(r.count) }))));
});

export default router;
