# n8n-nodes-ingravity

An n8n gate that sends each proposed action to InGravity before a workflow continues.

- `approved`: pass the input item to the next node and add the decision under `ingravity_check`.
- `blocked`: stop the workflow with InGravity's reason.
- `pending_approval`: stop the workflow until a person resolves the action in InGravity.
- An API/network error or an invalid response also stops the workflow.

Keep the node's n8n **On Error** setting at its default, **Stop Workflow**. Changing it to a continue mode can override normal node error handling.

## Build

From the InGravity repository root:

```sh
pnpm install
pnpm --filter n8n-nodes-ingravity run build
```

## Install in a local n8n instance

The following uses the standard n8n user directory for a self-hosted instance installed on the same machine:

```sh
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes
npm install /absolute/path/to/InGravity/integrations/n8n-nodes-ingravity
```

Replace the example path with the full path to this repository. Restart n8n after installing. The node appears in the node picker as **InGravity Guard**.

For a Docker-based n8n instance, the package must be visible inside the container. Copy or mount the built directory into it, then install it in the n8n user's `~/.n8n/nodes` directory and restart the container:

```sh
docker cp /absolute/path/to/InGravity/integrations/n8n-nodes-ingravity n8n:/tmp/n8n-nodes-ingravity
docker exec -it n8n sh -lc 'mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install /tmp/n8n-nodes-ingravity'
docker restart n8n
```

Use your actual container name instead of `n8n`. The n8n container must be able to reach the InGravity API URL. If the API is on the Docker host, use a host address reachable from the container (often `http://host.docker.internal:8080`); `localhost` inside the container refers to the container itself.

## Add it to a workflow

1. Add a **Manual Trigger** and a **Set** node with fields such as:

   ```json
   {
     "action_type": "payment",
     "amount": 500,
     "metadata": {
       "source": "n8n-local-test"
     }
   }
   ```

2. Add **InGravity Guard** after the Set node and before the real action.
3. Set **InGravity API Base URL** to a URL reachable from n8n, without `/check-action`. For an API running on the same host as a non-Docker n8n instance, use `http://localhost:8080`. If InGravity is running elsewhere, use that server's reachable URL.
4. Set **InGravity API Key** to the value of `INGRAVITY_API_KEY` (or the generated `artifacts/api-server/data/api-key` file).
5. Set **Action Type** to an expression such as `{{$json.action_type}}`.
6. Turn on **Include Amount** and set **Amount** to `{{$json.amount}}` if the action has a numeric amount.
7. Set **Metadata** to `{{$json.metadata}}` (or enter a JSON object directly).
8. Connect the guard's output to the node that performs the real action. Leave the guard's **On Error** setting at **Stop Workflow**.

For a quick gate test with the default InGravity payment rule, an amount of `500` is approved and continues to the next node. An amount of `1,250` becomes `pending_approval` and stops the workflow. An amount of `100,000` is blocked and stops with an error.

## API and security notes

The node sends one `POST <base URL>/check-action` request per input item with the same JSON shape as the API:

```json
{
  "action_type": "payment",
  "amount": 500,
  "metadata": {
    "source": "n8n"
  }
}
```

The node sends the shared API key in the `X-API-Key` header. Keep the key secret and do not commit it in a workflow export or repository.
