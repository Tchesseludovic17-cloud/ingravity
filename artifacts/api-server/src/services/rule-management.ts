import type { ActionInput, ActionRule, Decision } from "../domain/check-action";
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

export interface DurableRuleProposal {
  actionType: string;
  currentRule: ActionRule;
  proposedRule: ActionRule;
  summary: string;
}

export function proposeDurableRuleChange(
  action: ActionInput,
): DurableRuleProposal | undefined {
  if (action.amount === undefined) {
    return undefined;
  }

  const currentRule = getActiveRules().find(
    (rule) => rule.action_type === action.actionType,
  );
  if (
    currentRule?.max_amount === undefined ||
    action.amount <= currentRule.max_amount
  ) {
    return undefined;
  }

  const proposedRule: ActionRule = {
    ...currentRule,
    max_amount: action.amount,
  };
  return {
    actionType: action.actionType,
    currentRule,
    proposedRule,
    summary: `Augmenter max_amount de ${currentRule.max_amount} à ${action.amount} pour « ${action.actionType} » ; le seuil de blocage dur reste inchangé.`,
  };
}

export function applyDurableRuleProposal(
  proposal: DurableRuleProposal,
): ActionRule[] {
  const currentRules = getActiveRules();
  const current = currentRules.find(
    (rule) => rule.action_type === proposal.actionType,
  );
  if (
    !current ||
    JSON.stringify(current) !== JSON.stringify(proposal.currentRule)
  ) {
    throw new Error(
      "La règle a changé depuis la proposition ; demandez une nouvelle confirmation.",
    );
  }

  return saveActiveRules(
    currentRules.map((rule) =>
      rule.action_type === proposal.actionType ? proposal.proposedRule : rule,
    ),
  );
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
