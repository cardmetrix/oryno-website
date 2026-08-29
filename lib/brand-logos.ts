/**
 * Public logo/favicon APIs used when a provider image is missing or 404s.
 * Clearbit is intentionally omitted — that host no longer resolves.
 */

const KNOWN_BRAND_DOMAINS: Record<string, string> = {
  sportybet: "sportybet.com",
  "sporty-bet": "sportybet.com",
  bet9ja: "bet9ja.com",
  "1xbet": "1xbet.com",
  betking: "betking.com",
  melbet: "melbet.com",
  betway: "betway.com",
  nairabet: "nairabet.com",
  merrybet: "merrybet.com",
  naijabet: "naijabet.com",
  bangbet: "bangbet.com",
  livescorebet: "livescorebet.com",
  cloudbet: "cloudbet.com",
  betbiga: "betbiga.com",
  paripesa: "paripesa.com",
  nairamillion: "nairamillion.com",
  mylottohub: "mylottohub.com",
  premierbet: "premierbet.com",
  soccerbet: "soccerbet.com",
  betika: "betika.com",
  sportpesa: "sportpesa.com",
  odibets: "odibets.com",
  mozzart: "mozzartbet.com",
  hollywoodbets: "hollywoodbets.net",
  supersportbet: "supersportbet.com",
  easybet: "easybet.co.za",
  gbets: "gbets.co.za",
  "10bet": "10bet.com",
  dstv: "dstv.com",
  gotv: "gotv.com",
  startimes: "startimes.com",
  showmax: "showmax.com",
  ecg: "ecg.com.gh",
  gwcl: "gwcl.com.gh",
  mtn: "mtn.com",
  airtel: "airtel.com",
  glo: "gloworld.com",
  "9mobile": "9mobile.com.ng",
  smile: "smile.com.ng",
  spectranet: "spectranet.com.ng",
};

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function slugKey(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeLogoHost(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
}

function looksLikeHost(value: string) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizeLogoHost(value));
}

/** Country hosts like sportybet.com.gh still resolve logos from sportybet.com. */
export function canonicalLogoHosts(domain: string) {
  const host = normalizeLogoHost(domain);
  if (!host) return [];
  const hosts = [host];
  const parts = host.split(".");
  if (parts.length >= 3) {
    hosts.push(parts.slice(0, -1).join("."));
    hosts.push(`${parts[0]}.com`);
  } else if (
    parts.length === 2 &&
    !["com", "net", "org", "io", "app"].includes(parts[1])
  ) {
    hosts.push(`${parts[0]}.com`);
  }
  const known = KNOWN_BRAND_DOMAINS[slugKey(parts[0] || "")];
  if (known) hosts.unshift(known);
  return unique(hosts).slice(0, 2);
}

export function guessBrandDomain(nameOrId: string, domain?: string | null) {
  if (domain && looksLikeHost(domain)) {
    return canonicalLogoHosts(domain)[0] || normalizeLogoHost(domain);
  }
  const key = slugKey(nameOrId);
  if (KNOWN_BRAND_DOMAINS[key]) return KNOWN_BRAND_DOMAINS[key];
  for (const [name, host] of Object.entries(KNOWN_BRAND_DOMAINS)) {
    if (key.includes(name) || name.includes(key)) return host;
  }
  if (looksLikeHost(nameOrId)) return normalizeLogoHost(nameOrId);
  const compact = key.replace(/-/g, "");
  return compact ? `${compact}.com` : "example.com";
}

export function openLogoUrls(domainOrName: string) {
  const hosts = looksLikeHost(domainOrName)
    ? canonicalLogoHosts(domainOrName)
    : canonicalLogoHosts(guessBrandDomain(domainOrName));

  const urls: string[] = [];
  for (const host of hosts) {
    const encoded = encodeURIComponent(host);
    // Hunter is the public Clearbit replacement — real brand marks, no key.
    urls.push(`https://logos.hunter.io/${host}`);
    urls.push(`https://www.google.com/s2/favicons?domain=${encoded}&sz=128`);
    urls.push(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${host}`)}&size=128`,
    );
    urls.push(`https://icons.duckduckgo.com/ip3/${host}.ico`);
    urls.push(`https://icon.horse/icon/${host}`);
  }
  return unique(urls);
}

export function openLogoPrimary(domainOrName: string) {
  return openLogoUrls(domainOrName)[0];
}

export function serviceLogoSources(input: {
  src?: string | null;
  domain?: string | null;
  name?: string | null;
  fallbacks?: string[] | null;
}) {
  const seed = input.domain || input.name || "";
  return unique([
    input.src?.trim() || "",
    ...(input.fallbacks ?? []),
    ...(seed ? openLogoUrls(seed) : []),
  ]);
}
