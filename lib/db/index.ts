import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (process.env.NODE_ENV !== "production") {
  config({ path: ".env" });
}

const globalForDb = globalThis as unknown as {
  __orynoSql?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // Vercel/serverless: keep pool tiny so we don't exhaust Neon connections.
  const max = process.env.NODE_ENV === "production" ? 1 : 10;
  const disableSsl = /sslmode=disable/i.test(url);

  return postgres(url, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    ...(disableSsl ? {} : { ssl: "require" as const }),
  });
}

const client = globalForDb.__orynoSql ?? createClient();

// Reuse across warm serverless invocations + Next.js HMR in dev
globalForDb.__orynoSql = client;

export const db = drizzle(client, { schema });
