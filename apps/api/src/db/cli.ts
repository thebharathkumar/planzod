import { migrateDown, migrateUp } from "./migrate";
import { pool } from "./pool";

async function main() {
  const cmd = process.argv[2] ?? "up";
  if (cmd !== "up" && cmd !== "down") {
    throw new Error(`Unknown command: ${cmd}`);
  }

  try {
    if (cmd === "up") await migrateUp();
    if (cmd === "down") await migrateDown();
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
