import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getArtifactDirectory } from "../lib/paths";
import type {
  ActionEvaluation,
  ActionInput,
  Decision,
} from "../domain/check-action";

export interface StoredAction extends ActionInput, ActionEvaluation {
  id?: number;
  createdAt: string;
}

export interface ActionListItem {
  id: number;
  actionType: string;
  amount?: number;
  decision: Decision;
  riskScore: number;
  explanation?: string;
  createdAt: string;
}

export type ManualActionDecision = Extract<Decision, "approved" | "blocked">;

const configuredDatabasePath = process.env["INGRAVITY_DATABASE_PATH"];
const databasePath = configuredDatabasePath
  ? path.resolve(process.cwd(), configuredDatabasePath)
  : path.join(getArtifactDirectory(), "data", "ingravity.sqlite");

mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    amount REAL,
    metadata_json TEXT NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    created_at TEXT NOT NULL
  );
`);

try {
  database.exec("ALTER TABLE actions ADD COLUMN explanation TEXT");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
    throw error;
  }
}

const insertAction = database.prepare(`
  INSERT INTO actions (
    action_type,
    amount,
    metadata_json,
    decision,
    reason,
    risk_score,
    explanation,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const listActionsStatement = database.prepare(`
  SELECT id, action_type, amount, decision, risk_score, explanation, created_at
  FROM actions
  ORDER BY created_at DESC, id DESC
`);

const updatePendingActionStatement = database.prepare(`
  UPDATE actions
  SET decision = ?
  WHERE id = ? AND decision = 'pending_approval'
`);

const getActionStatement = database.prepare(`
  SELECT id, action_type, amount, metadata_json, decision, reason, risk_score, explanation, created_at
  FROM actions
  WHERE id = ?
`);

export function recordAction(
  action: ActionInput,
  evaluation: ActionEvaluation,
): StoredAction {
  const createdAt = new Date().toISOString();
  insertAction.run(
    action.actionType,
    action.amount ?? null,
    JSON.stringify(action.metadata),
    evaluation.decision,
    evaluation.reason,
    evaluation.riskScore,
    evaluation.explanation ?? null,
    createdAt,
  );

  return { ...action, ...evaluation, createdAt };
}

export function listActions(): ActionListItem[] {
  return listActionsStatement.all().map((row) => {
    const amount = row["amount"];

    return {
      id: Number(row["id"]),
      actionType: String(row["action_type"]),
      ...(amount === null ? {} : { amount: Number(amount) }),
      decision: row["decision"] as Decision,
      riskScore: Number(row["risk_score"]),
      ...(typeof row["explanation"] === "string"
        ? { explanation: String(row["explanation"]) }
        : {}),
      createdAt: String(row["created_at"]),
    };
  });
}

export function getAction(id: number): (StoredAction & { id: number }) | undefined {
  const row = getActionStatement.get(id) as Record<string, unknown> | undefined;
  if (!row) {
    return undefined;
  }

  const amount = row["amount"];
  return {
    id,
    actionType: String(row["action_type"]),
    ...(amount === null ? {} : { amount: Number(amount) }),
    metadata: JSON.parse(String(row["metadata_json"])) as Record<string, unknown>,
    decision: row["decision"] as Decision,
    reason: String(row["reason"]),
    riskScore: Number(row["risk_score"]),
    ...(typeof row["explanation"] === "string"
      ? { explanation: String(row["explanation"]) }
      : {}),
    createdAt: String(row["created_at"]),
  };
}

export function updatePendingActionDecision(
  id: number,
  decision: ManualActionDecision,
): boolean {
  const result = updatePendingActionStatement.run(decision, id);
  return Number(result.changes) > 0;
}
