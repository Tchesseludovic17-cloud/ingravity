# InGravity

**InGravity evaluates AI agent-proposed actions against configurable rules and records a decision before the calling system chooses what to do.**

> InGravity returns a decision; it does not execute, cancel, or intercept an external action. A connected caller must honor the decision.

## Example: before and after

An AI agent proposes a payment of `100000`. Without a guard, the agent's caller might submit it directly. With InGravity in the flow, the caller first sends the proposal to `POST /check-action`:

```sh
curl -X POST http://localhost:8080/check-action \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"payment","amount":100000,"metadata":{"order_id":"order-123"}}'
```

The configured hard limit returns `blocked` with a risk score of `100`. The caller can then decline to submit the payment. In this first version, that connection and enforcement are the caller's responsibility.

The API's `reason` text is currently returned in French. For this request, the response is:

```json
{
  "decision": "blocked",
  "reason": "Montant 100000 atteint le seuil de blocage automatique de 100000 ; action bloquée.",
  "risk_score": 100
}
```

## Project status

### Phase 1 — Rules engine and API: available

- `POST /check-action` evaluates an action. The same handler is also available at `POST /api/check-action`.
- Request fields: `action_type` (string), `amount` (optional non-negative number), and `metadata` (JSON object).
- Response fields: `decision` (`approved`, `blocked`, or `pending_approval`), `reason`, and `risk_score` (`0`–`100`).
- Rules are read from `artifacts/api-server/config/rules.json`.
- The included payment rule approves amounts up to `1000`, sends higher amounts for approval, and blocks amounts of `100000` or more.
- Valid requests and their decisions are recorded with a timestamp in a local SQLite database.
- An unknown `action_type` is approved by default. A missing amount for a matching amount rule is sent for approval because its limit cannot be checked.

This is an API backend, not an approval interface. It does not connect to payment systems or other external tools.

### Phase 2 — Dashboard: basic version available

- `/` displays the action history, newest first, with manual approve/block controls for pending actions.
- `/rules` displays the active rules, lets users add or replace simple amount rules, and activates the three predefined templates.
- The dashboard does not require authentication yet and is intended for local testing.

### Phase 3 — n8n integration and dry-run mode: in progress

- A local-installable **InGravity Guard** n8n node is available in [`integrations/n8n-nodes-ingravity`](integrations/n8n-nodes-ingravity/README.md). It continues only for `approved` and stops for `blocked` or `pending_approval`.
- Dry-run mode, which would simulate an action without carrying it out, is not implemented yet.

## Run locally (self-hosted)

### Requirements

- Node.js 24 or newer
- pnpm 10 or newer
- `curl` to try the API

### Install and start

1. Clone this repository and enter its directory:

   ```sh
   git clone <repository-url>
   cd ingravity
   ```

2. Enable pnpm through Corepack, then install workspace dependencies:

   ```sh
   corepack enable
   corepack prepare pnpm@10 --activate
   pnpm install
   ```

   The repository uses pnpm workspaces; run `pnpm install` from the repository root.

3. Start the API on port `8080`:

   ```sh
   PORT=8080 pnpm --filter @workspace/api-server run dev
   ```

   Keep this terminal open while the server is running. The first start builds the API and creates the local SQLite database directory and file automatically.

4. In a second terminal, send a test request:

   ```sh
   curl -X POST http://localhost:8080/check-action \
     -H 'Content-Type: application/json' \
     -d '{"action_type":"payment","amount":100000,"metadata":{"order_id":"order-123"}}'
   ```

   The expected decision is `blocked`. Try `"amount":500` for `approved`, or `"amount":1250` for `pending_approval`.

### Local data and configuration

- The default SQLite file is `artifacts/api-server/data/ingravity.sqlite`. The `data/` directory is excluded from Git.
- Use `http://localhost:8080/rules` to add or replace simple rules and activate templates; those changes take effect immediately. If you edit `artifacts/api-server/config/rules.json` directly, restart the API to load the changes.
- `INGRAVITY_DATABASE_PATH` optionally overrides the SQLite file path.
- `INGRAVITY_RULES_PATH` optionally overrides the JSON rules file path.
- `PORT` is required when starting the server directly; the example uses `8080`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
