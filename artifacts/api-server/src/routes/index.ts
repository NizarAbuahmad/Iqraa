import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import generateRouter from "./generate";
import authRouter from "./auth";
import workspaceRouter from "./workspace";
import verifiedMathRouter from "./verifiedMath";
import curriculumRouter from "./curriculum";
import rosterRouter from "./roster";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/workspace", workspaceRouter);
router.use(curriculumRouter);
router.use(rosterRouter);
router.use(chatRouter);
router.use(generateRouter);
router.use(verifiedMathRouter);

export default router;
