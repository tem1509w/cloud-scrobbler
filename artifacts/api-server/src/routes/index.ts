import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import healthRouter from "./health";
import authRouter from "./auth";
import scrobblesRouter from "./scrobbles";
import statsRouter from "./stats";
import playbackRouter from "./playback";
import presenceRouter from "./presence";

const router: IRouter = Router();

// Session recovery: the connect.sid cookie persists in the browser across server
// restarts, but MemoryStore is wiped on restart. Since we store sessionId in the
// DB, we can recover the userId on the first request after a restart.
router.use(async (req, _res, next) => {
  if (!req.session.userId && req.sessionID) {
    try {
      const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.sessionId, req.sessionID));
      if (user) {
        req.session.userId = user.id;
      }
    } catch {
      // Non-fatal — continue without recovery
    }
  }
  next();
});

router.use(healthRouter);
router.use(authRouter);
router.use(scrobblesRouter);
router.use(statsRouter);
router.use(playbackRouter);
router.use(presenceRouter);

export default router;
