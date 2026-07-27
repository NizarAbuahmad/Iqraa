import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import generateRouter from "./generate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(generateRouter);

export default router;
