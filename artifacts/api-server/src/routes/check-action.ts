import { Router, type Request, type Response } from "express";
import { findRule } from "../config/rules";
import {
  evaluateAction,
  type ActionInput,
} from "../domain/check-action";
import { recordAction } from "../repositories/action-repository";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function respondWithValidationError(res: Response, reason: string): void {
  res.status(400).json({ error: reason });
}

export function checkActionHandler(
  req: Request,
  res: Response,
): void {
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
  const evaluation = evaluateAction(action, findRule(action.actionType));
  recordAction(action, evaluation);

  res.json({
    decision: evaluation.decision,
    reason: evaluation.reason,
    risk_score: evaluation.riskScore,
  });
}

const router = Router();
router.post("/check-action", checkActionHandler);

export default router;
