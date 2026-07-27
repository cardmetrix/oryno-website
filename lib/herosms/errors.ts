/**
 * HeroSMS often returns Chinese (or mixed) API error strings.
 * Map known messages to clear English for the UI.
 */
const HERO_ERROR_EN: Record<string, string> = {
  您的请求包含无效数据: "Your request contains invalid data",
  请求包含无效数据: "Your request contains invalid data",
  无效的请求: "Invalid request",
  未授权: "Unauthorized — check your HeroSMS API key",
  没有权限: "Permission denied",
  余额不足: "Insufficient HeroSMS balance",
  没有可用的邮箱: "No emails available for this domain",
  没有可用邮箱: "No emails available for this domain",
  邮箱不存在: "Email activation not found",
  激活不存在: "Activation not found",
  服务不存在: "Service not found",
  参数错误: "Invalid parameters",
  缺少必要参数: "Missing required parameters",
  域名无效: "Invalid email domain",
  站点无效: "Invalid site",
  请求过于频繁: "Too many requests — try again shortly",
  内部服务器错误: "HeroSMS server error — try again",
};

export function herosmsErrorToEnglish(raw: unknown): string {
  const text = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return "Something went wrong with HeroSMS";

  if (HERO_ERROR_EN[text]) return HERO_ERROR_EN[text];

  for (const [zh, en] of Object.entries(HERO_ERROR_EN)) {
    if (text.includes(zh)) return en;
  }

  // Already English / unknown — return as-is
  return text;
}
