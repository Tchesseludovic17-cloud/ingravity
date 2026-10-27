import type {
  ActionEvaluation,
  ActionInput,
  ActionRule,
} from "../domain/check-action";
import type { ActionListItem } from "../repositories/action-repository";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b";
const DEFAULT_TIMEOUT_MS = 2_500;

function getTimeoutMs(): number {
  const configured = Number(process.env["INGRAVITY_ADVISOR_TIMEOUT_MS"]);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 10_000)
    : DEFAULT_TIMEOUT_MS;
}

function getOllamaConfig(): { baseUrl: string; model: string } {
  return {
    baseUrl: (process.env["OLLAMA_BASE_URL"] ?? DEFAULT_OLLAMA_URL).replace(/\/$/u, ""),
    model: process.env["OLLAMA_MODEL"] ?? DEFAULT_OLLAMA_MODEL,
  };
}

function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function cleanExplanation(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const explanation = value.trim();
  return explanation.length > 0 ? explanation.slice(0, 2_000) : undefined;
}

async function askOllama(prompt: string): Promise<string | undefined> {
  const { baseUrl, model } = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.2 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return undefined;
    }

    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return undefined;
    }

    return cleanExplanation((body as Record<string, unknown>)["response"]);
  } catch {
    // Advisor is best-effort: the rules engine and API must continue.
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export function getAdvisorModel(): string {
  return process.env["OLLAMA_MODEL"] ?? DEFAULT_OLLAMA_MODEL;
}

export function shouldAdvise(decision: ActionEvaluation["decision"]): boolean {
  return decision === "blocked" || decision === "pending_approval";
}

export async function explainDecision(
  action: ActionInput,
  rule: ActionRule | undefined,
  evaluation: ActionEvaluation,
): Promise<string | undefined> {
  if (!shouldAdvise(evaluation.decision)) {
    return undefined;
  }

  const prompt = [
    "Tu es l'Advisor d'InGravity.",
    "Le moteur de règles a déjà pris la décision ci-dessous. Tu ne dois jamais la modifier, la contester ni en proposer une autre.",
    "Explique en français, en deux phrases maximum, quelle règle précise s'applique et pourquoi l'action est bloquée ou mise en attente.",
    "Ne donne que l'explication destinée à l'utilisateur, sans titre, sans JSON et sans mentionner Ollama.",
    `Décision du moteur : ${evaluation.decision}`,
    `Score de risque : ${evaluation.riskScore}/100`,
    `Motif déterministe du moteur : ${evaluation.reason}`,
    `Règle appliquée : ${compactJson(rule ?? null)}`,
    `Action proposée : ${compactJson(action)}`,
  ].join("\n\n");

  return askOllama(prompt);
}

export async function askAdvisor(
  question: string,
  actions: ActionListItem[],
  rules: ActionRule[],
): Promise<string | undefined> {
  const prompt = [
    "Tu es Advisor, le centre de discussion d'InGravity.",
    "Tu aides à comprendre les décisions de sécurité, les règles actives et l'historique.",
    "Tu ne prends jamais de décision à la place du moteur, tu ne modifies jamais rules.json et tu ne prétends jamais avoir exécuté une action.",
    "Réponds en français, de manière concise, précise et professionnelle. Si la question demande d'autoriser ou de bloquer une action, rappelle que seul le moteur de règles peut décider.",
    `Question de l'utilisateur : ${question}`,
    `Règles actives : ${compactJson(rules)}`,
    `Historique récent : ${compactJson(actions.slice(0, 20))}`,
  ].join("\n\n");

  return askOllama(prompt);
}
