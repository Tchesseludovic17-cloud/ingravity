import { Router, type IRouter } from "express";
import healthRouter from "./health";
import checkActionRouter from "./check-action";
import templatesRouter from "./templates";

const router: IRouter = Router();

router.use(healthRouter);
router.use(checkActionRouter);
router.use(templatesRouter);

export default router;
