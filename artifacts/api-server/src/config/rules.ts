import { readFileSync } from "node:fs";
import path from "node:path";
import { getArtifactDirectory } from "../lib/paths";
import {
  type ActionRule,
  type Decision,
} from "../domain/check-action";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is Decision {
  return (
    value === "approved" ||
    value === "blocked" ||
    value === "pending_approval"
  );
}

function parseRule(value: unknown, index: number): ActionRule {
  if (!isRecord(value)) {
    throw new Error(`La règle numéro ${index + 1} doit être un objet JSON.`);
  }

  const {
    action_type,
    max_amount,
    action_if_exceeded,
    block_at_or_above,
    max_sends,
    send_count_field,
    sensitive_keywords,
    keyword_field,
    action_if_matched,
  } = value;
  if (typeof action_type !== "string" || action_type.trim().length === 0) {
    throw new Error(
      `La règle numéro ${index + 1} doit définir un action_type non vide.`,
    );
  }
  const hasAmountThreshold = max_amount !== undefined;
  if (hasAmountThreshold &&
    (typeof max_amount !== "number" ||
      !Number.isFinite(max_amount) ||
      max_amount < 0)
  ) {
    throw new Error(
      `La règle « ${action_type} » doit définir un max_amount positif ou nul.`,
    );
  }
  const hasSendThreshold = max_sends !== undefined;
  if (hasSendThreshold &&
    (typeof max_sends !== "number" ||
      !Number.isFinite(max_sends) ||
      max_sends < 0)
  ) {
    throw new Error(
      `La règle « ${action_type} » doit définir un max_sends positif ou nul.`,
    );
  }
  if (hasSendThreshold && (typeof send_count_field !== "string" || send_count_field.trim().length === 0)) {
    throw new Error(
      `La règle « ${action_type} » doit définir le champ send_count_field pour compter les envois.`,
    );
  }
  if (sensitive_keywords !== undefined &&
    (!Array.isArray(sensitive_keywords) ||
      sensitive_keywords.length === 0 ||
      sensitive_keywords.some((keyword) => typeof keyword !== "string" || keyword.trim().length === 0))
  ) {
    throw new Error(
      `La règle « ${action_type} » doit définir une liste de mots-clés sensibles non vide.`,
    );
  }
  if (sensitive_keywords !== undefined && (typeof keyword_field !== "string" || keyword_field.trim().length === 0)) {
    throw new Error(
      `La règle « ${action_type} » doit définir le champ keyword_field pour analyser les mots-clés.`,
    );
  }
  if (hasAmountThreshold || hasSendThreshold || sensitive_keywords !== undefined) {
    if (!isDecision(action_if_exceeded)) {
      throw new Error(
        `La règle « ${action_type} » doit définir action_if_exceeded avec approved, blocked ou pending_approval.`,
      );
    }
  } else if (!isDecision(action_if_matched)) {
    throw new Error(
      `La règle « ${action_type} » doit définir au moins un seuil ou action_if_matched valide.`,
    );
  }
  if (
    block_at_or_above !== undefined &&
    (typeof block_at_or_above !== "number" ||
      !Number.isFinite(block_at_or_above) ||
      !hasAmountThreshold ||
      block_at_or_above <= max_amount)
  ) {
    throw new Error(
      `La règle « ${action_type} » doit définir block_at_or_above comme un nombre supérieur à max_amount.`,
    );
  }

  return {
    action_type: action_type.trim(),
    ...(typeof max_amount === "number" ? { max_amount } : {}),
    ...(isDecision(action_if_exceeded) ? { action_if_exceeded } : {}),
    ...(typeof block_at_or_above === "number" ? { block_at_or_above } : {}),
    ...(typeof max_sends === "number" ? { max_sends } : {}),
    ...(typeof send_count_field === "string"
      ? { send_count_field: send_count_field.trim() }
      : {}),
    ...(Array.isArray(sensitive_keywords)
      ? { sensitive_keywords: sensitive_keywords.map((keyword) => String(keyword).trim()) }
      : {}),
    ...(typeof keyword_field === "string" ? { keyword_field: keyword_field.trim() } : {}),
    ...(isDecision(action_if_matched) ? { action_if_matched } : {}),
  };
}

export function parseRules(rawRules: unknown): ActionRule[] {
  if (!Array.isArray(rawRules)) {
    throw new Error("Les règles doivent être une liste JSON.");
  }
  const rules = rawRules.map(parseRule);
  const actionTypes = new Set<string>();
  for (const rule of rules) {
    if (actionTypes.has(rule.action_type)) {
      throw new Error(
        `Plusieurs règles définissent le même action_type : « ${rule.action_type} ».`,
      );
    }
    actionTypes.add(rule.action_type);
  }
  return rules;
}

export function getRulesPath(): string {
  const configuredPath = process.env["INGRAVITY_RULES_PATH"];
  return configuredPath
    ? path.resolve(process.cwd(), configuredPath)
    : path.join(getArtifactDirectory(), "config", "rules.json");
}

function loadRules(): ActionRule[] {
  const rulesPath = getRulesPath();

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(rulesPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Impossible de lire le fichier de règles ${rulesPath}. Vérifiez qu’il existe et que son contenu est un JSON valide.`,
      { cause: error },
    );
  }

  const rawRules = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed["rules"])
      ? parsed["rules"]
      : undefined;
  if (!rawRules) {
    throw new Error(
      "Le fichier de règles doit contenir une liste ou un objet { \"rules\": [...] }.",
    );
  }

  return parseRules(rawRules);
}

let actionRules = loadRules();

export function findRule(actionType: string): ActionRule | undefined {
  return actionRules.find((rule) => rule.action_type === actionType);
}

export function replaceActiveRules(rules: ActionRule[]): void {
  actionRules = rules;
}
