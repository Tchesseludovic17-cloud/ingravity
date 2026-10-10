import { Router, type IRouter } from "express";
import {
  listActions,
  updatePendingActionDecision,
  type ManualActionDecision,
} from "../repositories/action-repository";
import { renderActionsPage } from "../views/actions-page";

const router: IRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

router.get("/", (_req, res): void => {
  res
    .status(200)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(renderActionsPage(listActions()));
});

router.post("/actions/:id/decision", (req, res): void => {
  const rawId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const id = Number(rawId);

  if (!rawId || !Number.isSafeInteger(id) || id <= 0) {
    res.status(400).type("text").send("Identifiant d’action invalide.");
    return;
  }

  const body: unknown = req.body;
  const requestedDecision = isRecord(body) ? body["decision"] : undefined;
  if (requestedDecision !== "approved" && requestedDecision !== "blocked") {
    res.status(400).type("text").send("Décision manuelle invalide.");
    return;
  }

  const decision: ManualActionDecision = requestedDecision;
  const updated = updatePendingActionDecision(id, decision);
  if (!updated) {
    res
      .status(409)
      .type("text")
      .send("Cette action n’existe pas ou a déjà été tranchée.");
    return;
  }

  res.redirect(303, "/");
});

export default router;
