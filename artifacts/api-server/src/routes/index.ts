import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import scrobblesRouter from "./scrobbles";
import statsRouter from "./stats";
import playbackRouter from "./playback";
import presenceRouter from "./presence";

const router: IRouter = Router();

// Session recovery is now handled by connect-pg-simple store
// No need for manual recovery middleware

router.use(healthRouter);
router.use(authRouter);
router.use(scrobblesRouter);
router.use(statsRouter);
router.use(playbackRouter);
router.use(presenceRouter);

export default router;
