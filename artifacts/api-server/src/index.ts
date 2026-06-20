import app from "./app";
import { logger } from "./lib/logger";
import { startPoller } from "./lib/poller";
import { pool } from "@workspace/db";

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

const poller = startPoller();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing gracefully...");
  poller.stop();
  pool.end().then(() => {
    logger.info("Database pool closed");
    process.exit(0);
  }).catch((_err: unknown) => {
    logger.error("Error closing database pool");
    process.exit(1);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
