import { findRule } from "../config/rules";
import {
  evaluateAction,
  type ActionEvaluation,
  type ActionInput,
} from "../domain/check-action";
import { recordAction } from "../repositories/action-repository";
import { explainDecision } from "./advisor";

/**
 * Runs the deterministic engine first, then the best-effort Advisor, and
 * persists the final response. The Advisor cannot alter the decision.
 */
export async function evaluateAndRecordAction(
  action: ActionInput,
): Promise<ActionEvaluation> {
  const rule = findRule(action.actionType);
  const evaluation = evaluateAction(action, rule);
  const explanation = await explainDecision(action, rule, evaluation);
  const finalEvaluation = explanation
    ? { ...evaluation, explanation }
    : evaluation;

  recordAction(action, finalEvaluation);
  return finalEvaluation;
}
