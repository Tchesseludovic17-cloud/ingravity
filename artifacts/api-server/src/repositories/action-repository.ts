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
  createdAt: string;
}

export interface ActionListItem {
  id: number;
  actionType: string;
  amount?: number;
  decision: Decision;
  riskScore: number;
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

const insertAction = database.prepare(`
  INSERT INTO actions (
    action_type,
    amount,
    metadata_json,
    decision,
    reason,
    risk_score,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const listActionsStatement = database.prepare(`
  SELECT id, action_type, amount, decision, risk_score, created_at
  FROM actions
  ORDER BY created_at DESC, id DESC
`);

const updatePendingActionStatement = database.prepare(`
  UPDATE actions
  SET decision = ?
  WHERE id = ? AND decision = 'pending_approval'
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
      createdAt: String(row["created_at"]),
    };
  });
}

export function updatePendingActionDecision(
  id: number,
  decision: ManualActionDecision,
): boolean {
  const result = updatePendingActionStatement.run(decision, id);
  return Number(result.changes) > 0;
}
