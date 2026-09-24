/**
 * Run Drizzle migrations with a single direct connection.
 * Avoids Supabase session-pooler EMAXCONNSESSION (max ~15 clients).
 *
 * Usage: pnpm db:migrate
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  isPoolExhaustedError,
  resolveMigrateDatabaseUrl,
  sleep,
} from "../lib/db/migrate-url";

config({ path: resolve(process.cwd(), ".env") });

const MAX_ATTEMPTS = 5;

async function main() {
  const url = resolveMigrateDatabaseUrl();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "(invalid-url)";
    }
  })();

  console.log(`[db:migrate] connecting to ${host} (max 1 client)`);

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sql = postgres(url, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
      max_lifetime: 60 * 2,
      connect_timeout: 30,
      ssl: "require",
    });

    try {
      const db = drizzle(sql);
      await migrate(db, { migrationsFolder: resolve(process.cwd(), "lib/db/migrations") });
      console.log("[db:migrate] done");
      await sql.end({ timeout: 5 });
      return;
    } catch (error) {
      lastError = error;
      try {
        await sql.end({ timeout: 1 });
      } catch {
        // ignore
      }

      if (isPoolExhaustedError(error) && attempt < MAX_ATTEMPTS) {
        const waitMs = attempt * 2500;
        console.warn(
          `[db:migrate] pool busy (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${waitMs}ms…`,
        );
        await sleep(waitMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error("[db:migrate] failed");
  console.error(error);
  if (isPoolExhaustedError(error)) {
    console.error(`
Tip: Supabase session pooler is full (max ~15 clients).
1. Stop local \`pnpm dev\` / other apps using the DB and wait ~30s
2. In Supabase → Project Settings → Database, copy the Direct connection URI
3. Add to .env:
   DATABASE_URL_DIRECT=postgresql://postgres:...@db.<project>.supabase.co:5432/postgres
4. Re-run: pnpm db:migrate
`);
  }
  process.exit(1);
});
