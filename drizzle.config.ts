import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";
import { resolveMigrateDatabaseUrl } from "./lib/db/migrate-url";

config({ path: resolve(process.cwd(), ".env") });

const url = resolveMigrateDatabaseUrl();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
