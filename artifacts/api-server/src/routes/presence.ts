import { Router, type IRouter } from "express";
import { updatePresence } from "../lib/presence";

const router: IRouter = Router();

router.post("/presence/ping", (req, res): void => {
  if (req.session.userId) {
    updatePresence(req.session.userId);
  }
  res.json({ ok: true });
});

export default router;
