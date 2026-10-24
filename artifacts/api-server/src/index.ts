import app from "./app";
import { logger } from "./lib/logger";
import { initializeApiKey } from "./middlewares/api-key";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

initializeApiKey()
  .then(({ source }) => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port, apiKeySource: source }, "Server listening");
    });
  })
  .catch((error) => {
    logger.error({ err: error }, "Unable to initialize API key");
    process.exit(1);
  });
