import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (process.env.NODE_ENV !== "production") {
  config({ path: ".env" });
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __orynoSql?: ReturnType<typeof postgres>;
  __orynoDb?: Db;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // Vercel/serverless: keep pool tiny so we don't exhaust Neon/Supabase poolers.
  // Supabase session pooler (~15 clients) — stay at 1 locally too when using pooler host.
  const usingPooler = /pooler\.supabase\.com/i.test(url);
  const max =
    Number(process.env.DB_POOL_MAX) ||
    (process.env.NODE_ENV === "production" ? 1 : usingPooler ? 1 : 3);
  const disableSsl = /sslmode=disable/i.test(url);

  return postgres(url, {
    prepare: false,
    max,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    // Hotspot / flaky networks were hitting CONNECT_TIMEOUT at 10s.
    connect_timeout: 30,
    ...(disableSsl ? {} : { ssl: "require" as const }),
  });
}

function ensureDb(): Db {
  if (!globalForDb.__orynoSql || !globalForDb.__orynoDb) {
    globalForDb.__orynoSql = createClient();
    globalForDb.__orynoDb = drizzle(globalForDb.__orynoSql, { schema });
  }
  return globalForDb.__orynoDb;
}

/** Drop the pooled client after fatal connect errors so the next request reconnects. */
export async function resetDbClient(reason?: unknown) {
  const current = globalForDb.__orynoSql;
  globalForDb.__orynoSql = undefined;
  globalForDb.__orynoDb = undefined;
  if (current) {
    try {
      await current.end({ timeout: 1 });
    } catch {
      // ignore close errors
    }
  }
  if (reason) {
    console.warn("[db] reset client after connection error", reason);
  }
}

export function isDbConnectivityError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`
      : String(error);
  return /CONNECT_TIMEOUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED|connection.*closed|ENOTFOUND/i.test(
    text,
  );
}

/** Live db handle — always uses the current pool (survives resetDbClient). */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = ensureDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? (value as Function).bind(instance) : value;
  },
});
