import type { ActionRule, Decision } from "../domain/check-action";
import {
  getActiveRules,
  saveActiveRules,
} from "../config/rules";
import { ruleTemplates } from "../config/templates";

export interface AmountRuleInput {
  actionType: string;
  maxAmount: number;
  actionIfExceeded: Decision;
}

export function addOrReplaceAmountRule(input: AmountRuleInput): ActionRule[] {
  const currentRules = getActiveRules();
  const existingRule = currentRules.find(
    (rule) => rule.action_type === input.actionType,
  );

  const replacement: ActionRule = {
    action_type: input.actionType,
    max_amount: input.maxAmount,
    action_if_exceeded: input.actionIfExceeded,
  };

  if (existingRule?.block_at_or_above !== undefined) {
    if (existingRule.block_at_or_above <= input.maxAmount) {
      throw new Error(
        `Le nouveau seuil doit rester inférieur au seuil de blocage dur existant (${existingRule.block_at_or_above}).`,
      );
    }
    replacement.block_at_or_above = existingRule.block_at_or_above;
  }

  const nextRules = [
    ...currentRules.filter((rule) => rule.action_type !== input.actionType),
    replacement,
  ];
  return saveActiveRules(nextRules);
}

export function activateRuleTemplate(
  templateId: string,
): (typeof ruleTemplates)[number] | undefined {
  const template = ruleTemplates.find((candidate) => candidate.id === templateId);
  if (!template) {
    return undefined;
  }

  saveActiveRules(template.rules);
  return template;
}
