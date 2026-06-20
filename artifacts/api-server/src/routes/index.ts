import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import scrobblesRouter from "./scrobbles";
import statsRouter from "./stats";
import playbackRouter from "./playback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(scrobblesRouter);
router.use(statsRouter);
router.use(playbackRouter);

export default router;
