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

  // Single query for all counts using conditional aggregation
  const [statsRow] = await db.execute(sql<{ 
    total: number; 
    today: number; 
    week: number; 
    artists: number; 
    tracks: number 
  }>`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE scrobbled_at >= ${todayStart.toISOString()}) as today,
      COUNT(*) FILTER (WHERE scrobbled_at >= ${weekStart.toISOString()}) as week,
      COUNT(DISTINCT artist_name) as artists,
      COUNT(DISTINCT spotify_track_id) as tracks
    FROM scrobbles
    WHERE user_id = ${userId}
  `);

  res.json(
    GetStatsSummaryResponse.parse({
      totalScrobbles: Number(statsRow?.total ?? 0),
      uniqueArtists: Number(statsRow?.artists ?? 0),
      uniqueTracks: Number(statsRow?.tracks ?? 0),
      scrobblingEnabled: user.scrobblingEnabled === "true",
      todayCount: Number(statsRow?.today ?? 0),
      thisWeekCount: Number(statsRow?.week ?? 0),
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

  res.json(GetTopArtistsResponse.parse(rows.map((r: { artistName: string; count: number }) => ({ artistName: r.artistName, count: Number(r.count) }))));
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
      rows.map((r: { trackName: string; artistName: string; albumArt: string | null; count: number }) => ({
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

  res.json(GetScrobblesPerDayResponse.parse(rows.map((r: { date: string; count: number }) => ({ date: r.date, count: Number(r.count) }))));
});

export default router;
