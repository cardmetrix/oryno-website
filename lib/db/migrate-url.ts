import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

/**
 * Prefer a direct Postgres URL for DDL/migrations.
 * Supabase session-mode poolers cap at ~15 clients (EMAXCONNSESSION).
 */
export function resolveMigrateDatabaseUrl(): string {
  const direct =
    process.env.DATABASE_URL_DIRECT?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    "";
  if (direct) return direct;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Add it to .env (and optionally DATABASE_URL_DIRECT).",
    );
  }

  // Keep the pooler URL but pin connection_limit=1 for migrate.
  return withConnectionLimit(url, 1);
}

export function withConnectionLimit(url: string, limit: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("connection_limit", String(limit));
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}connection_limit=${limit}`;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isPoolExhaustedError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}`
      : String(error);
  return /EMAXCONNSESSION|max clients reached|remaining connection slots|too many clients/i.test(
    text,
  );
}
