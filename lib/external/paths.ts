/**
 * External mobile API path mapping.
 * Clients call:  /api/external/v1/<externalPath>
 * Server rewrites to: /api/<internalPath>
 */

/** First path segment must be one of these (admin/webhooks blocked). */
export const EXTERNAL_ALLOWED_ROOTS = new Set([
  "auth",
  "wallet",
  "transactions",
  "notifications",
  "devices",
  "ads",
  "profile",
  "settings",
  "me",
  "services",
  "support",
  "geo",
  "vtpass",
  "herosms",
  "jap",
  "reloadly",
  "sogo",
  "uploadthing",
]);

/**
 * Friendly domain aliases → existing first-party routes.
 * Unlisted paths pass through 1:1 under /api/.
 */
export const EXTERNAL_PATH_ALIASES: Record<string, string> = {
  // Airtime / data / bills
  "/services/airtime/purchase": "/vtpass/purchase/airtime",
  "/services/data/purchase": "/vtpass/purchase/data",
  "/services/bills/purchase": "/vtpass/purchase/bill",
  "/services/bills/verify": "/vtpass/verify",
  "/services/bills/variations": "/vtpass/variations",
  "/services/vtpass": "/vtpass/services",
  "/services/variations": "/vtpass/variations",
  "/services/international/countries": "/vtpass/international/countries",
  "/services/international/product-types":
    "/vtpass/international/product-types",
  "/services/international/operators": "/vtpass/international/operators",

  // Social
  "/services/social": "/jap/services",
  "/services/social/purchase": "/jap/purchase",
  "/services/social/status": "/jap/status",

  // Gift cards (buy = Reloadly, sell = Sogo)
  "/services/gift-cards/countries": "/reloadly/countries",
  "/services/gift-cards/products": "/reloadly/products",
  "/services/gift-cards/buy": "/reloadly/buy",
  "/services/gift-cards/sell/catalog": "/sogo/catalog",
  "/services/gift-cards/sell/rates": "/sogo/rates",
  "/services/gift-cards/sell": "/sogo/sell",

  // Virtual numbers / temp emails
  "/services/numbers/countries": "/herosms/countries",
  "/services/numbers/services": "/herosms/services",
  "/services/numbers/prices": "/herosms/prices",
  "/services/numbers/purchase": "/herosms/purchase/number",
  "/services/numbers/status": "/herosms/status/number",
  "/services/emails/domains": "/herosms/emails/domains",
  "/services/emails/purchase": "/herosms/purchase/email",
  "/services/emails/status": "/herosms/status/email",
};

export function normalizeExternalPath(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

function applyAlias(path: string): string {
  if (EXTERNAL_PATH_ALIASES[path]) return EXTERNAL_PATH_ALIASES[path];

  const entries = Object.entries(EXTERNAL_PATH_ALIASES).sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [from, to] of entries) {
    if (path.startsWith(`${from}/`)) {
      return `${to}${path.slice(from.length)}`;
    }
  }

  return path;
}

/**
 * Rewrite first-party `/api/services/*` friendly paths → real `/api/*` handlers.
 * `/api/services` (exact) is the catalog and must not be rewritten.
 */
export function resolveApiServicesRewrite(pathname: string): {
  ok: true;
  internalPath: string;
} | {
  ok: false;
  status: number;
  error: string;
} {
  const path = normalizeExternalPath(pathname);

  if (path === "/api/services") {
    return {
      ok: false,
      status: 404,
      error: "Catalog route should not be rewritten.",
    };
  }

  if (!path.startsWith("/api/services/")) {
    return {
      ok: false,
      status: 404,
      error: "Not a services API path.",
    };
  }

  const remainder = path.slice("/api".length); // /services/...
  const aliased = applyAlias(remainder);

  if (aliased === remainder || !aliased.startsWith("/")) {
    return {
      ok: false,
      status: 404,
      error: "Unknown service endpoint.",
    };
  }

  return { ok: true, internalPath: aliased };
}

/** Map `/api/external/v1/...` remainder to an internal `/api/...` path (no /api prefix). */
export function resolveExternalToInternal(externalRemainder: string): {
  ok: true;
  internalPath: string;
} | {
  ok: false;
  status: number;
  error: string;
} {
  const path = normalizeExternalPath(externalRemainder || "/");

  if (path === "/" || path === "") {
    return { ok: false, status: 404, error: "Use GET /api/external/v1 for the catalog." };
  }

  const aliased = applyAlias(path);
  const root = aliased.replace(/^\//, "").split("/")[0] ?? "";

  if (
    !EXTERNAL_ALLOWED_ROOTS.has(root) ||
    root === "admin" ||
    root === "webhooks" ||
    root === "external"
  ) {
    return { ok: false, status: 404, error: "Endpoint not available on the external API." };
  }

  return { ok: true, internalPath: aliased };
}
