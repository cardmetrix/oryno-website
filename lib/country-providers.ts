import {
  getCountryInfo,
  type SupportedCountryCode,
} from "@/lib/country";

export type ProviderCredential = {
  env: string;
  label: string;
};

export type CountryServiceProvider = {
  id: string;
  name: string;
  role: string;
  services: string[];
  countries: SupportedCountryCode[];
  signupUrl: string;
  dashboardUrl: string;
  apiKeysUrl: string;
  docsUrl: string;
  credentials: ProviderCredential[];
  notes?: string;
};

/**
 * Best live rails per ORYNO market, plus where to create the account
 * and copy API keys. Ledger stays NGN; these providers fulfill locally.
 */
export const SERVICE_PROVIDERS: CountryServiceProvider[] = [
  {
    id: "sogo",
    name: "Sogo",
    role: "Primary NG airtime, data, bills, gift-card sell",
    services: ["airtime", "data", "bills", "gift-cards-sell"],
    countries: ["NG"],
    signupUrl: "https://sogo.africa",
    dashboardUrl: "https://app.sogo.africa",
    apiKeysUrl: "https://app.sogo.africa/developer",
    docsUrl: "https://docs.sogo.africa",
    credentials: [
      { env: "SOGO_SECRET_KEY", label: "Secret key (sogo_sk_live_…)" },
      { env: "SOGO_PUBLIC_KEY", label: "Public key (sogo_pk_live_…)" },
      { env: "SOGO_WEBHOOK_SECRET", label: "Webhook signing secret" },
    ],
    notes: "Use the secret key, not the public key, for server calls.",
  },
  {
    id: "vtpass",
    name: "VTpass",
    role: "NG bills backup + international airtime/data for GH, KE, ZA",
    services: ["airtime", "data", "bills"],
    countries: ["NG", "GH", "KE", "ZA"],
    signupUrl: "https://vtpass.com/register",
    dashboardUrl: "https://vtpass.com/dashboard",
    apiKeysUrl: "https://vtpass.com/dashboard",
    docsUrl: "https://www.vtpass.com/documentation",
    credentials: [
      { env: "VTPASS_API_KEY", label: "API key" },
      { env: "VTPASS_PUBLIC_KEY", label: "Public key" },
      { env: "VTPASS_SECRET_KEY", label: "Secret key" },
      { env: "VTPASS_SANDBOX", label: "true for sandbox, false for live" },
    ],
    notes:
      "Sandbox: https://sandbox.vtpass.com — live: https://vtpass.com. International operators power Ghana/Kenya/South Africa airtime & data.",
  },
  {
    id: "reloadly",
    name: "Reloadly",
    role: "Gift-card buy in every market; Kenya & South Africa bills via Utilities",
    services: ["gift-cards-buy", "airtime", "data", "bills"],
    countries: ["NG", "GH", "KE", "ZA"],
    signupUrl: "https://www.reloadly.com/signup",
    dashboardUrl: "https://www.reloadly.com/dashboard",
    apiKeysUrl: "https://www.reloadly.com/developers",
    docsUrl: "https://docs.reloadly.com",
    credentials: [
      { env: "RELOADLY_CLIENT_ID", label: "Client ID (Gift Cards + Utilities)" },
      { env: "RELOADLY_CLIENT_SECRET", label: "Client secret" },
      { env: "RELOADLY_SANDBOX", label: "true for sandbox, false for live" },
      { env: "RELOADLY_DEMO", label: "true to force demo bills / gift cards" },
      { env: "RELOADLY_BILLER_DSTV_KE", label: "Optional DStv Kenya biller ID" },
      { env: "RELOADLY_BILLER_GOTV_KE", label: "Optional GOtv Kenya biller ID" },
      { env: "RELOADLY_BILLER_STARTIMES_KE", label: "Optional StarTimes Kenya biller ID" },
      { env: "RELOADLY_BILLER_ZUKU_KE", label: "Optional Zuku biller ID" },
      { env: "RELOADLY_BILLER_KPLC_PREPAID", label: "Optional KPLC prepaid biller ID" },
      { env: "RELOADLY_BILLER_KPLC_POSTPAID", label: "Optional KPLC postpaid biller ID" },
      { env: "RELOADLY_BILLER_NAIROBI_WATER", label: "Optional Nairobi Water biller ID" },
      { env: "RELOADLY_BILLER_DSTV_ZA", label: "Optional DStv South Africa biller ID" },
      { env: "RELOADLY_BILLER_GOTV_ZA", label: "Optional GOtv South Africa biller ID" },
      { env: "RELOADLY_BILLER_STARTIMES_ZA", label: "Optional StarTimes South Africa biller ID" },
      { env: "RELOADLY_BILLER_ESKOM_PREPAID", label: "Optional Eskom prepaid biller ID" },
      { env: "RELOADLY_BILLER_ESKOM_POSTPAID", label: "Optional Eskom postpaid biller ID" },
      { env: "RELOADLY_BILLER_CITY_POWER_PREPAID", label: "Optional City Power prepaid biller ID" },
      { env: "RELOADLY_BILLER_CITY_POWER_POSTPAID", label: "Optional City Power postpaid biller ID" },
      { env: "RELOADLY_BILLER_JHB_WATER", label: "Optional Johannesburg Water biller ID" },
    ],
    notes:
      "One Reloadly account covers all 4 countries. Developers → API credentials, then toggle Sandbox / Live. Kenya and South Africa bills use the Utilities product (audience https://utilities.reloadly.com) — enable Utility Payments on the same keys. Gift cards use a different audience. Airtime uses https://topups.reloadly.com if you enable it later.",
  },
  {
    id: "vtu-africa",
    name: "VTU Africa",
    role: "Nigeria betting wallet funding",
    services: ["betting"],
    countries: ["NG"],
    signupUrl: "https://vtuafrica.com.ng",
    dashboardUrl: "https://vtuafrica.com.ng/portal",
    apiKeysUrl: "https://vtuafrica.com.ng/portal",
    docsUrl: "https://vtuafrica.com.ng/api/betting.php",
    credentials: [
      { env: "VTU_AFRICA_API_KEY", label: "Betting API key" },
      { env: "BETTING_DEMO", label: "true to force local demo" },
    ],
  },
  {
    id: "hubtel",
    name: "Hubtel",
    role: "Best Ghana bills (ECG, DSTV Ghana, Ghana Water) + MoMo",
    services: ["bills", "wallet"],
    countries: ["GH"],
    signupUrl: "https://unity.hubtel.com/account/register",
    dashboardUrl: "https://unity.hubtel.com",
    apiKeysUrl: "https://developers.hubtel.com",
    docsUrl: "https://developers.hubtel.com",
    credentials: [
      { env: "HUBTEL_CLIENT_ID", label: "POS / API client ID" },
      { env: "HUBTEL_CLIENT_SECRET", label: "POS / API client secret" },
      { env: "HUBTEL_POS_ACCOUNT_ID", label: "Prepaid deposit account ID" },
      { env: "HUBTEL_SERVICE_ECG_PREPAID", label: "ECG prepaid commission service ID" },
      { env: "HUBTEL_SERVICE_GWCL", label: "Ghana Water commission service ID" },
    ],
    notes:
      "Register a merchant, create an app for Client ID + Secret, then copy the Prepaid Deposit Account ID from Money → Accounts. Subscribe to ECG, DStv, GOtv, and GWCL under Commission Services and paste any missing service IDs.",
  },
  {
    id: "africas-talking",
    name: "Africa's Talking",
    role: "Best Kenya airtime/data backup + SMS",
    services: ["airtime", "data"],
    countries: ["KE"],
    signupUrl: "https://account.africastalking.com/auth/register",
    dashboardUrl: "https://account.africastalking.com",
    apiKeysUrl: "https://account.africastalking.com/apps/sandbox/settings/key",
    docsUrl: "https://developers.africastalking.com/docs/airtime/overview",
    credentials: [
      { env: "AFRICASTALKING_USERNAME", label: "App username" },
      { env: "AFRICASTALKING_API_KEY", label: "API key" },
    ],
    notes:
      "Create an app, then copy the API key from Settings. Live keys are on the production app, not sandbox.",
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    role: "Wallet funding (cards / bank / MoMo) and payouts",
    services: ["wallet"],
    countries: ["NG", "GH", "KE", "ZA"],
    signupUrl: "https://dashboard.flutterwave.com/signup",
    dashboardUrl: "https://dashboard.flutterwave.com",
    apiKeysUrl: "https://dashboard.flutterwave.com/dashboard/settings/apis",
    docsUrl: "https://developer.flutterwave.com/docs",
    credentials: [
      { env: "FLUTTERWAVE_SECRET_KEY", label: "Secret key" },
      { env: "FLUTTERWAVE_PUBLIC_KEY", label: "Public key" },
      { env: "FLUTTERWAVE_WEBHOOK_HASH", label: "Webhook secret hash" },
    ],
    notes:
      "Primary wallet rail for Nigeria, Ghana, Kenya, and South Africa. Dedicated virtual accounts are Flutterwave on NG/GH; Paystack is used only if Flutterwave cannot issue an account (KE/ZA). Point your Flutterwave webhook to /api/webhooks/flutterwave and set the secret hash.",
  },
  {
    id: "paystack",
    name: "Paystack",
    role: "Fallback dedicated virtual accounts (Kenya / South Africa)",
    services: ["wallet"],
    countries: ["KE", "ZA"],
    signupUrl: "https://dashboard.paystack.com/#/signup",
    dashboardUrl: "https://dashboard.paystack.com",
    apiKeysUrl: "https://dashboard.paystack.com/#/settings/developer",
    docsUrl: "https://paystack.com/docs/api",
    credentials: [
      { env: "PAYSTACK_SECRET_KEY", label: "Secret key (optional fallback)" },
      { env: "PAYSTACK_PUBLIC_KEY", label: "Public key (optional fallback)" },
    ],
    notes:
      "Only used when Flutterwave cannot create a dedicated deposit account. Keep /api/webhooks/paystack configured if you enable this fallback.",
  },
  {
    id: "jap",
    name: "JustAnotherPanel",
    role: "Social boost catalog (all countries)",
    services: ["social"],
    countries: ["NG", "GH", "KE", "ZA"],
    signupUrl: "https://justanotherpanel.com/signup",
    dashboardUrl: "https://justanotherpanel.com",
    apiKeysUrl: "https://justanotherpanel.com/settings",
    docsUrl: "https://justanotherpanel.com/api",
    credentials: [{ env: "JAP_API_KEY", label: "API key" }],
  },
  {
    id: "herosms",
    name: "HeroSMS",
    role: "Virtual numbers + temporary emails (all countries)",
    services: ["virtual-numbers", "emails"],
    countries: ["NG", "GH", "KE", "ZA"],
    signupUrl: "https://hero-sms.com",
    dashboardUrl: "https://hero-sms.com",
    apiKeysUrl: "https://hero-sms.com",
    docsUrl: "https://hero-sms.com/api",
    credentials: [{ env: "HEROSMS_API_KEY", label: "API key" }],
  },
];

export const BEST_PROVIDER_BY_SERVICE: Record<
  SupportedCountryCode,
  Record<string, string>
> = {
  NG: {
    airtime: "sogo",
    data: "sogo",
    bills: "sogo",
    betting: "vtu-africa",
    "gift-cards-buy": "reloadly",
    "gift-cards-sell": "sogo",
    social: "jap",
    "virtual-numbers": "herosms",
    emails: "herosms",
    wallet: "flutterwave",
  },
  GH: {
    airtime: "vtpass",
    data: "vtpass",
    bills: "hubtel",
    betting: "demo",
    "gift-cards-buy": "reloadly",
    "gift-cards-sell": "sogo",
    social: "jap",
    "virtual-numbers": "herosms",
    emails: "herosms",
    wallet: "flutterwave",
  },
  KE: {
    airtime: "vtpass",
    data: "vtpass",
    bills: "reloadly",
    betting: "demo",
    "gift-cards-buy": "reloadly",
    "gift-cards-sell": "sogo",
    social: "jap",
    "virtual-numbers": "herosms",
    emails: "herosms",
    wallet: "flutterwave",
  },
  ZA: {
    airtime: "vtpass",
    data: "vtpass",
    bills: "reloadly",
    betting: "demo",
    "gift-cards-buy": "reloadly",
    "gift-cards-sell": "sogo",
    social: "jap",
    "virtual-numbers": "herosms",
    emails: "herosms",
    wallet: "flutterwave",
  },
};

export function providersForCountry(code: SupportedCountryCode) {
  return SERVICE_PROVIDERS.filter((p) => p.countries.includes(code));
}

export function providerSignupLinks(code?: string | null) {
  const country = getCountryInfo(code);
  return {
    country: country.code,
    countryName: country.name,
    currency: country.currency,
    providers: providersForCountry(country.code).map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      services: p.services,
      signupUrl: p.signupUrl,
      dashboardUrl: p.dashboardUrl,
      apiKeysUrl: p.apiKeysUrl,
      docsUrl: p.docsUrl,
      credentials: p.credentials,
      notes: p.notes ?? null,
    })),
  };
}
