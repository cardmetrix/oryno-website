export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@orynoafrica.com";

export const SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";

export const CRISP_WEBSITE_ID =
  process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim() || "";

export const USD_CARD_ISSUER = "Maplerad";

export const SUPPORT_TOPICS = [
  "Wallet & Funding",
  "Airtime / Data",
  "TV Bills",
  "Electricity",
  "Gift Cards",
  "Virtual Numbers",
  "USD Virtual Card",
  "Account & Security",
  "Other",
] as const;

export const SUPPORT_FAQS = [
  {
    q: "How do I fund my ORYNO wallet?",
    a: "Go to Wallet → Fund, pay with card or bank transfer, or use your dedicated virtual account. Funds usually appear within seconds after a successful payment.",
  },
  {
    q: "Why is my airtime or data purchase delayed?",
    a: "Most top-ups are instant. If a network is slow, your order stays in Processing and you’ll get a notification when it completes or fails with an automatic wallet refund.",
  },
  {
    q: "How do withdrawals work?",
    a: "Bank withdrawals have been removed. Move money between your local and USD wallets with Convert, or spend USD online with a virtual card from Cards.",
  },
  {
    q: "When will USD virtual cards launch?",
    a: `USD virtual cards (issued with ${USD_CARD_ISSUER}) are available under Cards. Issue a card, fund your USD wallet, then pay online worldwide. Reveal card details with your transaction PIN.`,
  },
  {
    q: "How do I verify my account (KYC)?",
    a: "Open Settings → KYC Verification and follow the steps. Some features may require KYC depending on your country and transaction limits.",
  },
] as const;
