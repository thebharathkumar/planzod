import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool";

type MigrationDirection = "up" | "down";

type MigrationFile = {
  name: string;
  direction: MigrationDirection;
  filePath: string;
};

function migrationsDir(): string {
  // Resolve relative to this file so it works regardless of cwd (e.g. npm run from monorepo root).
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, "..", "..", "migrations");
}

function parseMigrationFileName(fileName: string): MigrationFile | null {
  const match = fileName.match(/^(\d+_.+)\.(up|down)\.sql$/);
  if (!match) return null;
  const [, name, dirRaw] = match;
  const direction = dirRaw === "up" ? "up" : "down";
  return { name, direction, filePath: path.join(migrationsDir(), fileName) };
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function listMigrationFiles(direction: MigrationDirection): Promise<MigrationFile[]> {
  const entries = await fs.readdir(migrationsDir());
  return entries
    .map(parseMigrationFileName)
    .filter((m): m is MigrationFile => Boolean(m))
    .filter((m) => m.direction === direction)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function readSql(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function migrateUp(): Promise<void> {
  await ensureMigrationsTable();
  const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  const ups = await listMigrationFiles("up");
  const pending = ups.filter((m) => !applied.has(m.name));

  for (const m of pending) {
    const sql = await readSql(m.filePath);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations(name) VALUES ($1)", [m.name]);
      await pool.query("COMMIT");
      // eslint-disable-next-line no-console
      console.log(`Applied ${m.name}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  }
}

export async function migrateDown(): Promise<void> {
  await ensureMigrationsTable();
  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY applied_at DESC LIMIT 1"
  );
  const last = rows[0]?.name;
  if (!last) {
    // eslint-disable-next-line no-console
    console.log("No migrations to roll back.");
    return;
  }

  const downs = await listMigrationFiles("down");
  const down = downs.find((m) => m.name === last);
  if (!down) {
    throw new Error(`Missing down migration for ${last}`);
  }

  const sql = await readSql(down.filePath);
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("DELETE FROM schema_migrations WHERE name = $1", [last]);
    await pool.query("COMMIT");
    // eslint-disable-next-line no-console
    console.log(`Rolled back ${last}`);
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

