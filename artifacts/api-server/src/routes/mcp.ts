import { Router, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { getActiveRules } from "../config/rules";
import { listActions } from "../repositories/action-repository";
import { hasValidApiKey } from "../middlewares/api-key";
import { evaluateAndRecordAction } from "../services/action-evaluation";

const router = Router();

function unauthorized(req: Request, res: Response): boolean {
  const apiKey = req.header("X-API-Key");
  const bearer = req.header("Authorization")?.replace(/^Bearer\s+/iu, "");
  const candidate = apiKey ?? bearer;
  if (hasValidApiKey(candidate)) {
    return false;
  }

  res.status(401).json({
    error: "Unauthorized",
    message: "Une clé API valide est requise via X-API-Key ou Authorization: Bearer.",
  });
  return true;
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "ingravity-gateway",
    version: "0.1.0",
  });

  server.registerTool(
    "ingravity_check_action",
    {
      title: "Évaluer une action InGravity",
      description:
        "Évalue une action avec le moteur de règles InGravity. Le résultat est enregistré et contient approved, blocked ou pending_approval. Advisor explique après la décision sans jamais l’influencer.",
      inputSchema: {
        action_type: z.string().min(1).describe("Type d’action, par exemple payment ou deployment"),
        amount: z.number().min(0).optional().describe("Montant positif ou nul, si applicable"),
        metadata: z.record(z.string(), z.unknown()).describe("Métadonnées JSON de l’action"),
      },
    },
    async ({ action_type, amount, metadata }) => {
      const evaluation = await evaluateAndRecordAction({
        actionType: action_type.trim(),
        ...(amount === undefined ? {} : { amount }),
        metadata,
      });
      const result = {
        decision: evaluation.decision,
        reason: evaluation.reason,
        risk_score: evaluation.riskScore,
        ...(evaluation.explanation ? { explanation: evaluation.explanation } : {}),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "ingravity_list_actions",
    {
      title: "Consulter l’historique InGravity",
      description: "Retourne les dernières actions évaluées et leurs décisions.",
    },
    async () => {
      const actions = listActions();
      return {
        content: [{ type: "text", text: JSON.stringify(actions) }],
        structuredContent: { actions },
      };
    },
  );

  server.registerTool(
    "ingravity_get_rules",
    {
      title: "Consulter les règles InGravity",
      description: "Retourne les règles actives utilisées par le moteur de décision.",
    },
    async () => {
      const rules = getActiveRules();
      return {
        content: [{ type: "text", text: JSON.stringify(rules) }],
        structuredContent: { rules },
      };
    },
  );

  return server;
}

async function handleMcp(req: Request, res: Response): Promise<void> {
  if (unauthorized(req, res)) {
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    // Stateless mode works for remote MCP clients and does not retain
    // per-client state in the API process.
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

router.post("/mcp", (req, res) => {
  void handleMcp(req, res).catch((error: unknown) => {
    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP gateway error",
        message: error instanceof Error ? error.message : "Erreur MCP inconnue.",
      });
    }
  });
});

router.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").json({
    error: "Method Not Allowed",
    message: "Utilisez POST /mcp avec un client MCP Streamable HTTP.",
  });
});

export default router;
