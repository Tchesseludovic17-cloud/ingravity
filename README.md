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
- For `blocked` and `pending_approval`, the optional `explanation` field is generated after the rules engine by a local Ollama Advisor; it never changes the decision.
- An unknown `action_type` is approved by default. A missing amount for a matching amount rule is sent for approval because its limit cannot be checked.

This is an API backend, not an approval interface. It does not connect to payment systems or other external tools.

### Local Advisor (Ollama)

The Advisor uses Ollama at `http://127.0.0.1:11434` and the `qwen2.5:3b`
model by default. Configure `OLLAMA_BASE_URL` and `OLLAMA_MODEL` to override
these values. If Ollama is unavailable, the model is missing, or the request
fails, the API continues normally and omits `explanation`.

When a pending action is approved from the dashboard, the Advisor asks whether
the approval is exceptional (one time) or durable. Exceptional approval never
changes `rules.json`. A durable change is only proposed first and requires a
second explicit confirmation; the Advisor never writes the rules file itself.

### API authentication

Action evaluation and all data-changing routes require a shared API key in the
`X-API-Key` header. Set `INGRAVITY_API_KEY` before starting the server:

```sh
export INGRAVITY_API_KEY='replace-with-a-strong-secret'
PORT=8080 pnpm --filter @workspace/api-server run dev
```

When the variable is not set, the server generates a strong key automatically
and stores it in `artifacts/api-server/data/api-key` with file permissions
`600`. That path is ignored by Git. `INGRAVITY_API_KEY_FILE` can override the
storage location. Read-only dashboard views remain public for now.

Authenticated request example:

```sh
curl -X POST http://localhost:8080/check-action \
  -H 'X-API-Key: your-api-key' \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"payment","amount":1250,"metadata":{"order_id":"order-123"}}'
```

### Phase 2 — Dashboard: basic version available

- `/` displays the action history, newest first, with manual approve/block controls for pending actions.
- `/rules` displays the active rules, lets users add or replace simple amount rules, and activates the three predefined templates.
- Read-only dashboard pages are public for local inspection; dashboard actions that approve, block, or modify rules require `X-API-Key`.

### Phase 3 — n8n integration and MCP Gateway: available

- A local-installable **InGravity Guard** n8n node is available in [`integrations/n8n-nodes-ingravity`](integrations/n8n-nodes-ingravity/README.md). It continues only for `approved` and stops for `blocked` or `pending_approval`.
- Dry-run mode, which would simulate an action without carrying it out, is not implemented yet.
- The **MCP Gateway** is available directly from the API at `POST /mcp` (or `POST /api/mcp`). It exposes `ingravity_check_action`, `ingravity_list_actions`, and `ingravity_get_rules` to MCP clients without n8n.

#### Connect Claude or ChatGPT directly

Start the API, then configure the MCP server URL `http://localhost:8080/mcp` in a remote-MCP-capable client. The gateway accepts either the existing `X-API-Key` header or `Authorization: Bearer <api-key>`; it never exposes an unauthenticated action-evaluation tool.

Example MCP initialization request:

```sh
curl -X POST http://localhost:8080/mcp \
  -H "Authorization: Bearer your-api-key" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"my-client","version":"1"}}}'
```

For a client that accepts a Claude-style MCP server configuration, the equivalent entry is:

```json
{
  "mcpServers": {
    "ingravity": {
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer your-api-key" }
    }
  }
}
```

The MCP gateway calls the same decision service as the HTTP API: the deterministic rules engine decides first, Advisor explains afterward, and every evaluation is recorded in SQLite.

### SQLite reliability fix

SQLite initialization now runs each PRAGMA and schema operation separately, detects missing columns through `PRAGMA table_info`, and no longer relies on matching a version-specific migration error string. Writes use an explicit `BEGIN IMMEDIATE` transaction with bounded retries for `SQLITE_BUSY`/`SQLITE_LOCKED`. This protects existing databases and concurrent MCP/API requests while preserving the existing database path and schema.

## Run locally (self-hosted)

### Requirements

- Docker Engine with Docker Compose v2 (recommended method)
- Or, for the manual alternative: Node.js 24 or newer, pnpm 10 or newer,
  Ollama, and `curl`

### Recommended: one command with Docker Compose

1. Clone this repository and enter its directory:

   ```sh
   git clone <repository-url>
   cd ingravity
   ```

2. Start InGravity and Ollama together:

   ```sh
   docker compose up --build
   ```

   The first start builds the API image, starts Ollama, and downloads the
   `qwen2.5:3b` model automatically. The Ollama model is kept in the named
   `ollama-data` volume, so later starts do not download it again. InGravity
   stores its generated API key and SQLite data in the `ingravity-data` volume.

3. In a second terminal, retrieve the generated API key:

   ```sh
   docker compose exec ingravity cat /app/artifacts/api-server/data/api-key
   ```

4. Send a test request with that key:

   ```sh
   curl -X POST http://localhost:8080/check-action \
     -H "X-API-Key: $(docker compose exec -T ingravity cat /app/artifacts/api-server/data/api-key)" \
     -H 'Content-Type: application/json' \
     -d '{"action_type":"payment","amount":100000,"metadata":{"order_id":"order-123"}}'
   ```

   The expected decision is `blocked`, with an `explanation` once Ollama has
   finished downloading the model. Try `"amount":500` for `approved`, or
   `"amount":1250` for `pending_approval`.

### Alternative: manual installation without Docker

Use this mode if you prefer to install each service directly on the host.
Ollama is a required prerequisite for Advisor explanations in this mode:
install Ollama, start it, and download the model once:

In one terminal, start Ollama:

```sh
ollama serve
```

In a second terminal, download the model:

```sh
ollama pull qwen2.5:3b
```

In another terminal, install the project and start the API:

```sh
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
OLLAMA_BASE_URL=http://127.0.0.1:11434 \
OLLAMA_MODEL=qwen2.5:3b \
PORT=8080 pnpm --filter @workspace/api-server run dev
```

Keep both terminals open. If Ollama is stopped or unavailable, the API still
returns the rules-engine decision and `reason`, but omits `explanation`.

For a manual test request, first set the API key as documented above or read
the generated key from `artifacts/api-server/data/api-key`:

```sh
curl -X POST http://localhost:8080/check-action \
  -H 'X-API-Key: your-api-key' \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"payment","amount":100000,"metadata":{"order_id":"order-123"}}'
```

The expected decision is `blocked`. Try `"amount":500` for `approved`, or
`"amount":1250` for `pending_approval`.

### Local data and configuration

- The default SQLite file is `artifacts/api-server/data/ingravity.sqlite`. The `data/` directory is excluded from Git.
- Use `http://localhost:8080/rules` to add or replace simple rules and activate templates; those changes take effect immediately. If you edit `artifacts/api-server/config/rules.json` directly, restart the API to load the changes.
- `INGRAVITY_DATABASE_PATH` optionally overrides the SQLite file path.
- `INGRAVITY_RULES_PATH` optionally overrides the JSON rules file path.
- `PORT` is required when starting the server directly; the example uses `8080`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
