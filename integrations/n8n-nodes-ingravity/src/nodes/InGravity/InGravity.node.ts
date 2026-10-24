import {
  NodeOperationError,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
} from "n8n-workflow";

type InGravityDecision = "approved" | "blocked" | "pending_approval";

interface InGravityResponse {
  decision: InGravityDecision;
  reason: string;
  risk_score: number;
}

interface ActionRequest {
  action_type: string;
  amount?: number;
  metadata: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  let metadata = value;
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata) as unknown;
    } catch {
      return undefined;
    }
  }
  return isRecord(metadata) ? metadata : undefined;
}

function parseResponse(value: unknown): InGravityResponse | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { decision, reason, risk_score } = value;
  if (
    (decision !== "approved" &&
      decision !== "blocked" &&
      decision !== "pending_approval") ||
    typeof reason !== "string" ||
    typeof risk_score !== "number" ||
    !Number.isFinite(risk_score) ||
    risk_score < 0 ||
    risk_score > 100
  ) {
    return undefined;
  }

  return { decision, reason, risk_score };
}

export class InGravityGuard implements INodeType {
  description: INodeTypeDescription = {
    displayName: "InGravity Guard",
    name: "inGravityGuard",
    group: ["transform"],
    version: 1,
    description:
      "Check every proposed action with InGravity before the workflow continues.",
    defaults: {
      name: "InGravity Guard",
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "InGravity API Base URL",
        name: "apiBaseUrl",
        type: "string",
        default: "http://localhost:8080",
        required: true,
        placeholder: "https://your-ingravity-api.example",
        description:
          "Root URL of the InGravity API. Do not include /check-action.",
      },
      {
        displayName: "InGravity API Key",
        name: "apiKey",
        type: "string",
        typeOptions: {
          password: true,
        },
        default: "",
        required: true,
        description:
          "Shared API key sent in the X-API-Key header to authenticate with InGravity.",
      },
      {
        displayName: "Action Type",
        name: "action_type",
        type: "string",
        default: "",
        required: true,
        placeholder: "payment",
        description:
          "Must match the action_type used by your InGravity rules.",
      },
      {
        displayName: "Include Amount",
        name: "include_amount",
        type: "boolean",
        default: false,
        description: "Turn on when this action has a numeric amount.",
      },
      {
        displayName: "Amount",
        name: "amount",
        type: "number",
        default: 0,
        displayOptions: {
          show: {
            include_amount: [true],
          },
        },
        description: "The amount to send to InGravity.",
      },
      {
        displayName: "Metadata",
        name: "metadata",
        type: "json",
        default: "{}",
        required: true,
        description: "A JSON object with additional action details.",
      },
    ],
  };

  async execute(
    this: IExecuteFunctions,
  ): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const outputItems: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const apiBaseUrl = this.getNodeParameter(
        "apiBaseUrl",
        itemIndex,
      ) as string;
      const apiKey = this.getNodeParameter("apiKey", itemIndex) as string;
      const actionType = this.getNodeParameter(
        "action_type",
        itemIndex,
      ) as string;
      const includeAmount = this.getNodeParameter(
        "include_amount",
        itemIndex,
        false,
      ) as boolean;
      const metadataValue = this.getNodeParameter(
        "metadata",
        itemIndex,
        "{}",
      ) as unknown;
      const metadata = parseMetadata(metadataValue);

      if (typeof apiBaseUrl !== "string" || apiBaseUrl.trim().length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          "InGravity API Base URL is required.",
          { itemIndex },
        );
      }
      if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          "InGravity API Key is required.",
          { itemIndex },
        );
      }
      if (typeof actionType !== "string" || actionType.trim().length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          "Action Type is required before InGravity can check this item.",
          { itemIndex },
        );
      }
      if (!metadata) {
        throw new NodeOperationError(
          this.getNode(),
          "Metadata must be a valid JSON object.",
          { itemIndex },
        );
      }

      const requestBody: ActionRequest = {
        action_type: actionType.trim(),
        metadata,
      };
      if (includeAmount) {
        const amountValue = this.getNodeParameter(
          "amount",
          itemIndex,
          0,
        ) as number;
        if (
          typeof amountValue !== "number" ||
          !Number.isFinite(amountValue) ||
          amountValue < 0
        ) {
          throw new NodeOperationError(
            this.getNode(),
            "Amount must be a finite number greater than or equal to zero.",
            { itemIndex },
          );
        }
        requestBody.amount = amountValue;
      }

      let rawResponse: unknown;
      try {
        rawResponse = await this.helpers.httpRequest({
          method: "POST",
          url: `${apiBaseUrl.trim().replace(/\/+$/, "")}/check-action`,
          body: requestBody,
          headers: {
            "X-API-Key": apiKey.trim(),
          },
          json: true,
          timeout: 30000,
        });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown request error";
        throw new NodeOperationError(
          this.getNode(),
          `Could not reach the InGravity API: ${detail}`,
          { itemIndex },
        );
      }

      const result = parseResponse(rawResponse);
      if (!result) {
        throw new NodeOperationError(
          this.getNode(),
          "InGravity returned an invalid response. Expected decision, reason, and risk_score.",
          { itemIndex },
        );
      }

      if (result.decision === "blocked") {
        throw new NodeOperationError(
          this.getNode(),
          `InGravity blocked this action (risk ${result.risk_score}/100): ${result.reason}`,
          { itemIndex },
        );
      }
      if (result.decision === "pending_approval") {
        throw new NodeOperationError(
          this.getNode(),
          `InGravity requires human approval; the workflow has stopped (risk ${result.risk_score}/100): ${result.reason}`,
          { itemIndex },
        );
      }

      outputItems.push({
        ...inputItems[itemIndex],
        json: {
          ...inputItems[itemIndex].json,
          ingravity_check: result,
        },
        pairedItem: { item: itemIndex },
      });
    }

    return [outputItems];
  }
}

// n8n resolves the node class from the file name (InGravity.node.js).
export class InGravity extends InGravityGuard {}
