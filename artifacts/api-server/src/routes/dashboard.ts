import { Router, type IRouter } from "express";
import {
  listActions,
  updatePendingActionDecision,
  type ManualActionDecision,
} from "../repositories/action-repository";
import { getActiveRules } from "../config/rules";
import { ruleTemplates } from "../config/templates";
import {
  activateRuleTemplate,
  addOrReplaceAmountRule,
} from "../services/rule-management";
import { renderActionsPage } from "../views/actions-page";
import { renderRulesPage } from "../views/rules-page";
import { requireApiKey } from "../middlewares/api-key";

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

router.get("/rules", (req, res): void => {
  const notice = req.query["notice"];
  const message =
    notice === "rule-saved"
      ? "La règle a été enregistrée."
      : notice === "template-activated"
        ? "Le modèle a été activé et remplace les règles précédentes."
        : undefined;

  res
    .status(200)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(renderRulesPage(getActiveRules(), ruleTemplates, message));
});

router.post("/rules", requireApiKey, (req, res): void => {
  const body: unknown = req.body;
  const actionType =
    isRecord(body) && typeof body["action_type"] === "string"
      ? body["action_type"].trim()
      : "";
  const rawAmount = isRecord(body) ? body["max_amount"] : undefined;
  const amount =
    typeof rawAmount === "string" && rawAmount.trim().length > 0
      ? Number(rawAmount)
      : typeof rawAmount === "number"
        ? rawAmount
        : Number.NaN;
  const actionIfExceeded = isRecord(body)
    ? body["action_if_exceeded"]
    : undefined;

  if (
    actionType.length === 0 ||
    actionType.length > 100 ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    (actionIfExceeded !== "approved" &&
      actionIfExceeded !== "blocked" &&
      actionIfExceeded !== "pending_approval")
  ) {
    res
      .status(400)
      .type("text")
      .send("Type d’action, seuil ou décision invalide.");
    return;
  }

  try {
    addOrReplaceAmountRule({
      actionType,
      maxAmount: amount,
      actionIfExceeded,
    });
  } catch (error) {
    res
      .status(400)
      .type("text")
      .send(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer cette règle.",
      );
    return;
  }

  res.redirect(303, "/rules?notice=rule-saved");
});

router.post("/rules/templates/:id/activate", requireApiKey, (req, res): void => {
  const templateId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  if (!templateId) {
    res.status(404).type("text").send("Modèle de règles introuvable.");
    return;
  }

  try {
    const template = activateRuleTemplate(templateId);
    if (!template) {
      res.status(404).type("text").send("Modèle de règles introuvable.");
      return;
    }
  } catch {
    res
      .status(500)
      .type("text")
      .send("Impossible d’enregistrer les règles du modèle.");
    return;
  }

  res.redirect(303, "/rules?notice=template-activated");
});

router.post("/actions/:id/decision", requireApiKey, (req, res): void => {
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
