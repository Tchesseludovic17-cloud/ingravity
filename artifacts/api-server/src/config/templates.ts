import { readFileSync } from "node:fs";
import path from "node:path";
import type { ActionRule } from "../domain/check-action";
import { getArtifactDirectory } from "../lib/paths";
import { parseRules } from "./rules";

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  rules: ActionRule[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadTemplates(): RuleTemplate[] {
  const templatesPath = path.join(
    getArtifactDirectory(),
    "config",
    "templates.json",
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(templatesPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Impossible de lire le fichier de modèles ${templatesPath}. Vérifiez qu’il existe et que son contenu est un JSON valide.`,
      { cause: error },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Le fichier de modèles doit contenir une liste JSON.");
  }

  const ids = new Set<string>();
  return parsed.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`Le modèle numéro ${index + 1} doit être un objet JSON.`);
    }

    const { id, name, description, rules } = value;
    if (
      typeof id !== "string" ||
      id.trim().length === 0 ||
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      throw new Error(
        `Le modèle numéro ${index + 1} doit définir id, name et description.`,
      );
    }
    if (ids.has(id)) {
      throw new Error(`L’identifiant de modèle « ${id} » est utilisé plusieurs fois.`);
    }
    ids.add(id);

    return {
      id: id.trim(),
      name: name.trim(),
      description: description.trim(),
      rules: parseRules(rules),
    };
  });
}

export const ruleTemplates = loadTemplates();
