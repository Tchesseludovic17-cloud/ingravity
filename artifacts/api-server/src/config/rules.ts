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
  } = value;
  if (typeof action_type !== "string" || action_type.trim().length === 0) {
    throw new Error(
      `La règle numéro ${index + 1} doit définir un action_type non vide.`,
    );
  }
  if (
    typeof max_amount !== "number" ||
    !Number.isFinite(max_amount) ||
    max_amount < 0
  ) {
    throw new Error(
      `La règle « ${action_type} » doit définir un max_amount positif ou nul.`,
    );
  }
  if (!isDecision(action_if_exceeded)) {
    throw new Error(
      `La règle « ${action_type} » doit définir action_if_exceeded avec approved, blocked ou pending_approval.`,
    );
  }
  if (
    block_at_or_above !== undefined &&
    (typeof block_at_or_above !== "number" ||
      !Number.isFinite(block_at_or_above) ||
      block_at_or_above <= max_amount)
  ) {
    throw new Error(
      `La règle « ${action_type} » doit définir block_at_or_above comme un nombre supérieur à max_amount.`,
    );
  }

  return {
    action_type: action_type.trim(),
    max_amount,
    action_if_exceeded,
    ...(typeof block_at_or_above === "number" ? { block_at_or_above } : {}),
  };
}

function loadRules(): ActionRule[] {
  const configuredPath = process.env["INGRAVITY_RULES_PATH"];
  const rulesPath = configuredPath
    ? path.resolve(process.cwd(), configuredPath)
    : path.join(getArtifactDirectory(), "config", "rules.json");

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

export const actionRules = loadRules();

export function findRule(actionType: string): ActionRule | undefined {
  return actionRules.find((rule) => rule.action_type === actionType);
}
