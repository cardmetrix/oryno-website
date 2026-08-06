import type { NextRequest } from "next/server";

const DEFAULT_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "https://orynoafrica.com",
  "https://www.orynoafrica.com",
];

function allowedOrigins(): string[] {
  const fromEnv =
    process.env.EXTERNAL_API_ALLOWED_ORIGINS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

export function resolveCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const allowed = allowedOrigins();
  if (allowed.includes("*")) return "*";
  if (allowed.includes(origin)) return origin;

  // Expo web / LAN dev often uses http://192.168.x.x:port
  if (
    process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
      origin,
    )
  ) {
    return origin;
  }

  return null;
}

export function corsHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = resolveCorsOrigin(request);

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  } else if (!request.headers.get("origin")) {
    // Native apps send no Origin — allow without ACAO restriction
    headers.set("Access-Control-Allow-Origin", "*");
  }

  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, X-Requested-With, X-Oryno-Client, X-Oryno-App-Version, X-Oryno-Admin-Session",
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Access-Control-Expose-Headers", "X-Oryno-Api-Version");
  headers.set("X-Oryno-Api-Version", "1");
  return headers;
}

export function applyCorsHeaders(target: Headers, request: NextRequest) {
  corsHeaders(request).forEach((value, key) => {
    target.set(key, value);
  });
}
