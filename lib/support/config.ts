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
  "Bill Payments",
  "Gift Cards",
  "Virtual Numbers",
  "Rent Email",
  "USD Virtual Card",
  "Account & Security",
  "Other",
] as const;

export const SUPPORT_FAQS = [
  {
    q: "How do I fund my ORYNO wallet?",
    a: "Go to Wallet → Fund, pay with card or bank transfer via Flutterwave, or use your dedicated virtual account. Funds usually appear within seconds after a successful payment.",
  },
  {
    q: "Why is my airtime or data purchase delayed?",
    a: "Most top-ups are instant. If a network is slow, your order stays in Processing and you’ll get a notification when it completes or fails with an automatic wallet refund.",
  },
  {
    q: "How do withdrawals work?",
    a: "Open Wallet → Withdraw, enter the amount, choose a payout bank, then confirm with your transaction PIN. We debit your wallet and send the transfer via Flutterwave. Typical timing is a few minutes.",
  },
  {
    q: "When will USD virtual cards launch?",
    a: `USD virtual cards (issued with ${USD_CARD_ISSUER}) are coming soon for online payments worldwide. Join the waitlist from your USD wallet — we’ll email and push you as soon as cards go live in your country. Gift cards are already live under Services → Gift Cards.`,
  },
  {
    q: "How do I verify my account (KYC)?",
    a: "Open Settings → KYC Verification and follow the steps. Some features may require KYC depending on your country and transaction limits.",
  },
] as const;
