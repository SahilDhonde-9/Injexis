import { Router } from "express";
import { getStats, getAttackTypes, getRecentActivity } from "../lib/local-store";

const router = Router();

router.get("/stats", async (_req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    _req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/stats/attack-types", async (_req, res) => {
  try {
    res.json(getAttackTypes());
  } catch (err) {
    _req.log.error({ err }, "Failed to fetch attack types");
    res.status(500).json({ error: "Failed to fetch attack types" });
  }
});

router.get("/stats/recent-activity", async (_req, res) => {
  try {
    res.json(getRecentActivity());
  } catch (err) {
    _req.log.error({ err }, "Failed to fetch recent activity");
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

export default router;
