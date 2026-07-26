import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config({ path: ".env" });

const globalForDb = globalThis as unknown as {
  __orynoSql?: ReturnType<typeof postgres>;
};

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  return postgres(url, {
    // Neon / serverless-friendly: avoid cached prepared statements across connections
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.__orynoSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__orynoSql = client;
}

export const db = drizzle(client, { schema });
