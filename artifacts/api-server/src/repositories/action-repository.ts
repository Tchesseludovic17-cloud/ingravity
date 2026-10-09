import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getArtifactDirectory } from "../lib/paths";
import type { ActionInput, ActionEvaluation } from "../domain/check-action";

export interface StoredAction extends ActionInput, ActionEvaluation {
  createdAt: string;
}

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
