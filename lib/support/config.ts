export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@orynoafrica.com";

export const SUPPORT_PHONE =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim() || "";

export const CRISP_WEBSITE_ID =
  process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim() || "";

export const USD_CARD_ISSUER = "Maplerad";

/** Ticket topics aligned to live ORYNO services. */
export const SUPPORT_TOPICS = [
  "Wallet & Funding",
  "Airtime",
  "Data Bundles",
  "Electricity",
  "TV Bills",
  "Betting",
  "Social Boost",
  "Virtual Numbers",
  "Gift Cards",
  "Invoice Generator",
  "Payment Links",
  "Account & Security",
  "Other",
] as const;

/** FAQs for services ORYNO currently offers (not coming-soon). */
export const SUPPORT_FAQS = [
  {
    q: "How do I fund my ORYNO wallet?",
    a: "Open Fund on your dashboard or Wallet, then pay with card, bank transfer, or your dedicated virtual account. Successful payments usually credit your local wallet within seconds. Use Convert to move money between local and USD wallets.",
  },
  {
    q: "How do I buy airtime?",
    a: "Go to Services → Airtime, pick your network, enter the phone number and amount, then pay from your wallet. Top-ups are usually instant; if a network is slow, the order stays in Processing until it completes or fails with an automatic refund.",
  },
  {
    q: "How do data bundles work?",
    a: "Open Services → Data Bundles, choose a network and plan (daily, weekly, or monthly), confirm the number, and pay from your wallet. Delivery is typically instant once the provider confirms the order.",
  },
  {
    q: "How do I pay electricity bills?",
    a: "Go to Services → Electricity, select your disco, enter and verify your meter number, then pay from your wallet. Prepaid tokens are shown in the order receipt and History after a successful payment.",
  },
  {
    q: "How do I pay TV bills (DStv, GOtv, StarTimes)?",
    a: "Open Services → TV Bills, choose your provider, enter your smartcard / IUC number, pick a bouquet or amount, and pay from your wallet. Subscriptions usually update within a few minutes.",
  },
  {
    q: "How do I fund a betting account?",
    a: "Go to Services → Betting, select your bookmaker, enter and verify the customer ID, then fund from your wallet. Credits are typically instant once the provider confirms.",
  },
  {
    q: "How does Social Boost work?",
    a: "Open Services → Social Boost, pick a platform and package (followers, likes, views, and more), paste your profile or post link, and pay from your wallet. Orders start soon after payment — track progress in History.",
  },
  {
    q: "How do virtual numbers work?",
    a: "Go to Services → Virtual Numbers, choose a country and service (WhatsApp, Telegram, and more), then buy or rent a number with your wallet. SMS codes appear in the order screen while the number is active.",
  },
  {
    q: "How do I buy gift cards?",
    a: "Open Services → Buy Gift Cards (or Gift Card Live), pick a brand and amount, and pay with your USD wallet balance. Codes are delivered instantly in the order receipt and History after a successful purchase.",
  },
  {
    q: "How does the Invoice Generator work?",
    a: "Open Services → Invoice Generator to create professional invoices with bill-from/to, line items, tax, discount, and shipping. Download a PDF anytime. Payment Links are a separate tool if you only need a checkout link.",
  },
  {
    q: "What are Payment Links?",
    a: "Go to Services → Payment Links to create a standalone Flutterwave checkout for deposits, retainers, or one-off charges — without building a full invoice. Share the link and get paid when your customer completes payment.",
  },
] as const;
