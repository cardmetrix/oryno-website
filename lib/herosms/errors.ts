import { publicServiceError, SERVICE_UNAVAILABLE } from "@/lib/service-errors";

/**
 * Provider API often returns Chinese (or mixed) error strings / SMS-Activate codes.
 * Map known messages to clear English for the UI — never expose provider brand.
 */
const HERO_ERROR_EN: Record<string, string> = {
  您的请求包含无效数据:
    "Your request contains invalid data. Try another domain or site.",
  请求包含无效数据:
    "Your request contains invalid data. Try another domain or site.",
  无效的请求: "Invalid request",
  未授权:
    "Not authorized for this service. Contact ORYNO support.",
  没有权限: "Permission denied for this service.",
  余额不足: SERVICE_UNAVAILABLE,
  没有可用的邮箱: "No emails available for this domain. Try another one.",
  没有可用邮箱: "No emails available for this domain. Try another one.",
  邮箱不存在: "Email activation not found",
  激活不存在: "Activation not found",
  服务不存在: "Service not found",
  参数错误: "Invalid parameters",
  缺少必要参数: "Missing required parameters",
  域名无效: "Invalid email domain",
  站点无效: "Invalid site",
  请求过于频繁: "Too many requests — try again shortly",
  内部服务器错误: "Something went wrong — try again",
  UNPROCESSABLE_ENTITY:
    "That site or domain isn’t available. Try another combination.",
  "Unprocessable Entity":
    "That site or domain isn’t available. Try another combination.",
  UNAUTHORIZED: "Not authorized for this service. Contact ORYNO support.",
  Unauthorized: "Not authorized for this service. Contact ORYNO support.",
  NO_NUMBERS:
    "No numbers available for this country and service. Try another country.",
  NO_BALANCE: SERVICE_UNAVAILABLE,
  BAD_KEY:
    "Service credentials are invalid. Contact ORYNO support.",
  BAD_SERVICE: "This service isn’t available right now. Try another one.",
  BAD_ACTION: "Something went wrong. Please try again.",
  BAD_STATUS: "Couldn’t update number status. Please try again.",
  ERROR_SQL: "Something went wrong. Please try again.",
  NO_ACTIVATION: "Activation not found",
  WRONG_ACTIVATION_ID: "Activation not found",
  WRONG_MAX_PRICE: "Price changed — refresh and try again.",
  WRONG_SERVICE: "This service isn’t available right now.",
  CHANNELS_LIMIT:
    "Too many active numbers. Finish or cancel one, then try again.",
};

export function herosmsErrorToEnglish(raw: unknown): string {
  const text = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return "Something went wrong. Please try again.";

  const upper = text.toUpperCase();
  if (HERO_ERROR_EN[upper]) return publicServiceError(HERO_ERROR_EN[upper]);
  if (HERO_ERROR_EN[text]) return publicServiceError(HERO_ERROR_EN[text]);

  for (const [key, en] of Object.entries(HERO_ERROR_EN)) {
    if (text.includes(key) || upper.includes(key.toUpperCase())) {
      return publicServiceError(en);
    }
  }

  // HTTP status leftovers
  if (/\b401\b/.test(text)) {
    return "Not authorized for this service. Contact ORYNO support.";
  }

  return publicServiceError(
    text
      .replace(/HeroSMS/gi, "ORYNO")
      .replace(/hero-sms/gi, "oryno")
      .replace(/VTpass/gi, "ORYNO")
      .replace(/JustAnotherPanel/gi, "ORYNO"),
  );
}

/** Normalize signup site for email rentals (host only, lowercase). */
export function normalizeEmailSite(site: string) {
  return site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/[?#].*$/, "");
}
