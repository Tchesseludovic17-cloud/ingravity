import { Router, type Request, type Response } from "express";
import { findRule } from "../config/rules";
import {
  evaluateAction,
  type ActionInput,
} from "../domain/check-action";
import { recordAction } from "../repositories/action-repository";
import { requireApiKey } from "../middlewares/api-key";
import { explainDecision } from "../services/advisor";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function respondWithValidationError(res: Response, reason: string): void {
  res.status(400).json({ error: reason });
}

export async function checkActionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!isRecord(req.body)) {
    respondWithValidationError(res, "Le corps de la requête doit être un objet JSON.");
    return;
  }

  const { action_type, amount, metadata } = req.body;
  if (typeof action_type !== "string" || action_type.trim().length === 0) {
    respondWithValidationError(
      res,
      "Le champ action_type doit être une chaîne de caractères non vide.",
    );
    return;
  }

  if (
    amount !== undefined &&
    (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)
  ) {
    respondWithValidationError(
      res,
      "Le champ amount doit être un nombre positif ou nul lorsqu’il est fourni.",
    );
    return;
  }

  if (!isRecord(metadata)) {
    respondWithValidationError(
      res,
      "Le champ metadata doit être un objet JSON.",
    );
    return;
  }

  const action: ActionInput = {
    actionType: action_type.trim(),
    ...(typeof amount === "number" ? { amount } : {}),
    metadata,
  };
  const rule = findRule(action.actionType);
  const evaluation = evaluateAction(action, rule);
  // This call happens strictly after evaluateAction. It cannot change the result.
  const explanation = await explainDecision(action, rule, evaluation);
  const finalEvaluation = explanation
    ? { ...evaluation, explanation }
    : evaluation;
  recordAction(action, finalEvaluation);

  res.json({
    decision: finalEvaluation.decision,
    reason: finalEvaluation.reason,
    risk_score: finalEvaluation.riskScore,
    ...(finalEvaluation.explanation
      ? { explanation: finalEvaluation.explanation }
      : {}),
  });
}

const router = Router();
router.post("/check-action", requireApiKey, checkActionHandler);

export default router;
