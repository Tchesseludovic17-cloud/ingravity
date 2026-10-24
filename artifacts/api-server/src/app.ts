import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { checkActionHandler } from "./routes/check-action";
import dashboardRouter from "./routes/dashboard";
import { logger } from "./lib/logger";
import { requireApiKey } from "./middlewares/api-key";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(dashboardRouter);

// The direct path is available for the requested POST /check-action endpoint.
app.post("/check-action", requireApiKey, checkActionHandler);

// Keep the workspace's existing /api namespace working as well.
app.use("/api", router);

export default app;
