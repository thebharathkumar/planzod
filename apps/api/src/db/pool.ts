import pg from "pg";
import { env } from "../env";

const { Pool } = pg;

// Supabase + most managed Postgres providers require TLS. We turn on SSL
// automatically when we detect one of those hosts or when running in
// production. `rejectUnauthorized: false` accepts the provider's self-signed
// CA, which is what Supabase / Render / Heroku / Railway all use.
function shouldUseSsl(url: string): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (url.includes("sslmode=require")) return true;
  if (/\b(supabase\.(co|com)|render\.com|amazonaws\.com|neon\.tech)\b/.test(url)) {
    return true;
  }
  return false;
}

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: shouldUseSsl(env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
});
