import { Router, type IRouter } from "express";
import { listActions } from "../repositories/action-repository";
import { renderActionsPage } from "../views/actions-page";

const router: IRouter = Router();

router.get("/", (_req, res): void => {
  res
    .status(200)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(renderActionsPage(listActions()));
});

export default router;
