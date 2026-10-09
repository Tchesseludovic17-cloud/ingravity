import { Router, type IRouter } from "express";
import healthRouter from "./health";
import checkActionRouter from "./check-action";

const router: IRouter = Router();

router.use(healthRouter);
router.use(checkActionRouter);

export default router;
