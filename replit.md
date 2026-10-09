# InGravity

API backend qui évalue les actions proposées par des agents IA, applique des règles configurables et enregistre les décisions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `POST /check-action` and `POST /api/check-action` — evaluate an action
- Optional env: `INGRAVITY_DATABASE_PATH` — SQLite file location
- Optional env: `INGRAVITY_RULES_PATH` — JSON rules file location

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: SQLite using Node.js `node:sqlite`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/domain/` — action types, decisions, and risk calculation
- `artifacts/api-server/src/config/` — rules loader and default JSON rules
- `artifacts/api-server/src/repositories/` — SQLite persistence
- `artifacts/api-server/src/routes/` — HTTP endpoints
- `artifacts/api-server/README.md` — beginner-friendly French guide and API examples
- `lib/api-spec/openapi.yaml` — API contract used to generate client types

## Architecture decisions

- Rules are loaded once at server startup; restart the server after editing `config/rules.json`.
- If an action has a matching amount rule but omits `amount`, it is held for approval rather than automatically approved.
- SQLite is stored locally in `artifacts/api-server/data/` by default; the directory is excluded from Git.

## Product

This first version only exposes the action-checking API. Do not add the future approval dashboard or n8n/dry-run integration until requested.

## User preferences

- Explain created project files and how to test the API in French, in beginner-friendly terms.

## Gotchas

- The API service is routed under `/api`; the exact `/check-action` path is separately exposed as requested.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
