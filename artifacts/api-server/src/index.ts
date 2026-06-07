import app from "./app";
import { logger } from "./lib/logger";
import { ensureSessionTable } from "./lib/session";
import { ensureAppSettingsTable } from "./lib/bootstrap-app-settings";
import { ensureUsersTable, seedSuperuser } from "./lib/bootstrap-users";

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

async function main() {
  // Bootstrap the session table before accepting traffic so the very first
  // login request can't race the schema migration. Same applies to the
  // app_settings singleton row — auth reads from it on every login.
  await Promise.all([
    ensureSessionTable(),
    ensureAppSettingsTable(),
    ensureUsersTable().then(seedSuperuser),
  ]);

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
