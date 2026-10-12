const assert = require("node:assert/strict");
const test = require("node:test");
const { InGravityGuard } = require("../dist/nodes/InGravity/InGravity.node.js");

const nodeDetails = {
  name: "InGravity Guard",
  type: "n8n-nodes-ingravity.inGravityGuard",
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
};

function createContext(response, overrides = {}) {
  const parameters = {
    apiBaseUrl: "https://ingravity.example/",
    action_type: "payment",
    include_amount: true,
    amount: 500,
    metadata: { source: "n8n-test" },
    ...overrides,
  };
  const inputItems = [{ json: { orderId: "order-42" } }];
  const requests = [];
  const context = {
    getInputData: () => inputItems,
    getNodeParameter: (name, _itemIndex, fallback) =>
      Object.hasOwn(parameters, name) ? parameters[name] : fallback,
    getNode: () => nodeDetails,
    helpers: {
      httpRequest: async (options) => {
        requests.push(options);
        if (response instanceof Error) {
          throw response;
        }
        return response;
      },
    },
  };
  return { context, inputItems, requests };
}

test("approved passes the item forward and posts the API payload", async () => {
  const apiResponse = {
    decision: "approved",
    reason: "Amount is within the limit.",
    risk_score: 0,
  };
  const { context, inputItems, requests } = createContext(apiResponse);

  const result = await InGravityGuard.prototype.execute.call(context);

  assert.equal(result[0].length, 1);
  assert.deepEqual(result[0][0].json, {
    ...inputItems[0].json,
    ingravity_check: apiResponse,
  });
  assert.deepEqual(requests[0].body, {
    action_type: "payment",
    amount: 500,
    metadata: { source: "n8n-test" },
  });
  assert.equal(requests[0].url, "https://ingravity.example/check-action");
});

test("blocked stops execution with a clear error", async () => {
  const { context } = createContext({
    decision: "blocked",
    reason: "Hard block threshold reached.",
    risk_score: 100,
  });

  await assert.rejects(
    InGravityGuard.prototype.execute.call(context),
    /InGravity blocked this action.*Hard block threshold reached/,
  );
});

test("pending approval stops execution instead of passing the item through", async () => {
  const { context } = createContext({
    decision: "pending_approval",
    reason: "A person must review this action.",
    risk_score: 40,
  });

  await assert.rejects(
    InGravityGuard.prototype.execute.call(context),
    /requires human approval.*A person must review this action/,
  );
});

test("omits amount when the optional amount toggle is off", async () => {
  const { context, requests } = createContext(
    {
      decision: "approved",
      reason: "No amount rule matched.",
      risk_score: 0,
    },
    { include_amount: false },
  );

  await InGravityGuard.prototype.execute.call(context);

  assert.deepEqual(requests[0].body, {
    action_type: "payment",
    metadata: { source: "n8n-test" },
  });
});
