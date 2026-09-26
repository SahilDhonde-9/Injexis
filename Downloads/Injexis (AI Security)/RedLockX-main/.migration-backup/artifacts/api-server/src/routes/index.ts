import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import logsRouter from "./logs";
import statsRouter from "./stats";
import settingsRouter from "./settings";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(logsRouter);
router.use(statsRouter);
router.use(settingsRouter);
router.use(chatRouter);

export default router;
