export type Decision = "approved" | "blocked" | "pending_approval";

export interface ActionInput {
  actionType: string;
  amount?: number;
  metadata: Record<string, unknown>;
}

export interface ActionRule {
  action_type: string;
  max_amount: number;
  action_if_exceeded: Decision;
}

export interface ActionEvaluation {
  decision: Decision;
  reason: string;
  riskScore: number;
}

export function evaluateAction(
  action: ActionInput,
  rule: ActionRule | undefined,
): ActionEvaluation {
  if (!rule) {
    return {
      decision: "approved",
      reason: `Aucune règle ne correspond à l’action « ${action.actionType} » ; approbation par défaut.`,
      riskScore: 0,
    };
  }

  if (action.amount === undefined) {
    return {
      decision: "pending_approval",
      reason: `Montant absent : impossible de vérifier la limite de ${rule.max_amount} ; approbation humaine requise.`,
      riskScore: 0,
    };
  }

  if (action.amount <= rule.max_amount) {
    return {
      decision: "approved",
      reason: `Montant conforme à la limite configurée de ${rule.max_amount}.`,
      riskScore: 0,
    };
  }

  const riskScore =
    rule.max_amount === 0
      ? 100
      : Math.min(
          100,
          Math.ceil(
            ((action.amount - rule.max_amount) / rule.max_amount) * 100,
          ),
        );

  return {
    decision: rule.action_if_exceeded,
    reason: `Montant ${action.amount} supérieur à la limite de ${rule.max_amount} ; décision appliquée : ${rule.action_if_exceeded}.`,
    riskScore,
  };
}
