export type Decision = "approved" | "blocked" | "pending_approval";

export interface ActionInput {
  actionType: string;
  amount?: number;
  metadata: Record<string, unknown>;
}

export interface ActionRule {
  action_type: string;
  max_amount?: number;
  action_if_exceeded?: Decision;
  block_at_or_above?: number;
  max_sends?: number;
  send_count_field?: string;
  sensitive_keywords?: string[];
  keyword_field?: string;
  action_if_matched?: Decision;
}

export interface ActionEvaluation {
  decision: Decision;
  reason: string;
  riskScore: number;
  explanation?: string;
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

  if (rule.action_if_matched) {
    return {
      decision: rule.action_if_matched,
      reason: `Le type d’action « ${action.actionType} » correspond à une règle qui impose « ${rule.action_if_matched} ».`,
      riskScore: 100,
    };
  }

  let riskScore = 0;
  const reasons: string[] = [];
  const missingChecks: string[] = [];
  let thresholdExceeded = false;

  if (rule.max_amount !== undefined) {
    if (action.amount === undefined) {
      missingChecks.push(`montant absent (limite : ${rule.max_amount})`);
    } else {
      const amountRisk =
        action.amount <= rule.max_amount
          ? 0
          : rule.max_amount === 0
            ? 100
            : Math.min(
                100,
                Math.ceil(
                  ((action.amount - rule.max_amount) / rule.max_amount) * 100,
                ),
              );
      riskScore = Math.max(riskScore, amountRisk);

      if (
        rule.block_at_or_above !== undefined &&
        action.amount >= rule.block_at_or_above
      ) {
        return {
          decision: "blocked",
          reason: `Montant ${action.amount} atteint le seuil de blocage automatique de ${rule.block_at_or_above} ; action bloquée.`,
          riskScore,
        };
      }

      if (action.amount > rule.max_amount) {
        thresholdExceeded = true;
        reasons.push(
          `montant ${action.amount} supérieur à la limite de ${rule.max_amount}`,
        );
      }
    }
  }

  if (rule.max_sends !== undefined && rule.send_count_field) {
    const sendCount = action.metadata[rule.send_count_field];
    if (
      typeof sendCount !== "number" ||
      !Number.isFinite(sendCount) ||
      sendCount < 0
    ) {
      missingChecks.push(
        `nombre d’envois absent ou invalide (champ metadata.${rule.send_count_field})`,
      );
    } else {
      const sendRisk =
        sendCount <= rule.max_sends
          ? 0
          : rule.max_sends === 0
            ? 100
            : Math.min(
                100,
                Math.ceil(((sendCount - rule.max_sends) / rule.max_sends) * 100),
              );
      riskScore = Math.max(riskScore, sendRisk);

      if (sendCount > rule.max_sends) {
        thresholdExceeded = true;
        reasons.push(
          `${sendCount} envois dépassent la limite de ${rule.max_sends}`,
        );
      }
    }
  }

  if (rule.sensitive_keywords && rule.keyword_field) {
    const content = action.metadata[rule.keyword_field];
    if (typeof content !== "string") {
      missingChecks.push(
        `contenu absent ou invalide (champ metadata.${rule.keyword_field})`,
      );
    } else {
      const normalizedContent = content.toLocaleLowerCase();
      const matchedKeywords = rule.sensitive_keywords.filter((keyword) =>
        normalizedContent.includes(keyword.toLocaleLowerCase()),
      );
      if (matchedKeywords.length > 0) {
        thresholdExceeded = true;
        riskScore = 100;
        reasons.push(
          `mot(s)-clé(s) sensible(s) détecté(s) : ${matchedKeywords.join(", ")}`,
        );
      }
    }
  }

  if (missingChecks.length > 0) {
    return {
      decision: "pending_approval",
      reason: `Vérification incomplète : ${missingChecks.join("; ")} ; approbation humaine requise.`,
      riskScore,
    };
  }

  if (thresholdExceeded) {
    const decision = rule.action_if_exceeded ?? "pending_approval";
    return {
      decision,
      reason: `${reasons.join("; ")} ; décision appliquée : ${decision}.`,
      riskScore,
    };
  }

  if (rule.max_amount !== undefined) {
    return {
      decision: "approved",
      reason: `Montant conforme à la limite configurée de ${rule.max_amount}.`,
      riskScore,
    };
  }

  if (rule.max_sends !== undefined && rule.send_count_field) {
    return {
      decision: "approved",
      reason: `Nombre d’envois conforme à la limite configurée de ${rule.max_sends}.`,
      riskScore,
    };
  }

  if (rule.sensitive_keywords?.length) {
    return {
      decision: "approved",
      reason: "Aucun mot-clé sensible configuré n’a été détecté.",
      riskScore,
    };
  }

  return {
    decision: "approved",
    reason: "Aucun seuil configuré n’a été dépassé.",
    riskScore,
  };
}
