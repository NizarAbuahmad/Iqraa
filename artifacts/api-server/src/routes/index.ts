import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import generateRouter from "./generate";
import authRouter from "./auth";
import workspaceRouter from "./workspace";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/workspace", workspaceRouter);
router.use(chatRouter);
router.use(generateRouter);

export default router;
