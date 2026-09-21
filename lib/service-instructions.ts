export type ServiceInstructionId =
  | "airtime"
  | "data"
  | "bills"
  | "electricity"
  | "social"
  | "virtual-numbers"
  | "gift-cards"
  | "betting"
  | "catalog";

export type ServiceInstructionsContent = {
  title?: string;
  subtitle: string;
  steps: string[];
};

export const SERVICE_INSTRUCTIONS: Record<
  ServiceInstructionId,
  ServiceInstructionsContent
> = {
  airtime: {
    subtitle: "Follow these steps to top up any network",
    steps: [
      "Make sure your ORYNO wallet has enough balance (Fund wallet if needed).",
      "Select the network for the phone number you want to top up.",
      "Enter the phone number carefully — double-check the digits.",
      "Choose or type an amount, then confirm and pay from your wallet.",
      "Airtime is usually delivered instantly. Check History if you need a receipt.",
    ],
  },
  data: {
    subtitle: "Follow these steps to buy a data plan",
    steps: [
      "Fund your wallet so you can pay for the plan.",
      "Pick the network that matches the SIM receiving the data.",
      "Enter the phone number and choose a daily, weekly, or monthly plan.",
      "Confirm the price and pay from your wallet.",
      "Data usually activates within minutes. Open History for the receipt.",
    ],
  },
  bills: {
    subtitle: "Follow these steps to pay TV or water bills",
    steps: [
      "Fund your wallet so you can pay for the subscription.",
      "Pick your TV provider (DStv, GOtv, StarTimes) or water utility where available.",
      "Enter your smartcard or account number and wait for verification.",
      "Select a bouquet or amount, then pay from your wallet.",
      "Keep the receipt from History for your records.",
    ],
  },
  electricity: {
    subtitle: "Follow these steps to buy electricity",
    steps: [
      "Fund your wallet — electricity is paid from your ORYNO balance.",
      "Select your disco or power utility (IKEDC, EKEDC, ECG, KPLC, Eskom, etc.).",
      "Enter your meter number and wait for the account name to verify.",
      "Choose prepaid or postpaid, enter an amount, then pay from your wallet.",
      "Copy your token from the success screen — also available later in History.",
    ],
  },
  social: {
    subtitle: "Follow these steps to boost your social account",
    steps: [
      "Fund your wallet — boosts are paid from your ORYNO balance.",
      "Choose a platform (Instagram, TikTok, YouTube, and more).",
      "Search and pick a service, then set quantity (within min–max).",
      "Paste your public profile or post link exactly as shown on the app.",
      "Confirm and pay — track status on the success screen; keep the account public while processing.",
    ],
  },
  "virtual-numbers": {
    subtitle:
      "Match your location to the number’s country — or WhatsApp/Telegram may refuse the code",
    steps: [
      "Fund your USD wallet first — virtual numbers are charged in USD at purchase.",
      "Select the app you need to verify (WhatsApp, Telegram, Google, Instagram, etc.).",
      "Pick the country for the phone number. Your phone’s location or VPN must match that country, or verification usually fails.",
      "Before you tap Get number: turn on a VPN set to the same country as the number you are buying, open the target app, and keep the VPN on until the SMS code arrives.",
      "Pay to reserve the number, copy it into the app’s signup/verify screen, then stay on this page — the code appears here automatically when provider receives the SMS.",
      "If no SMS arrives within about an hour, the purchase is refunded to your USD wallet. Do not reuse a number after the session ends.",
    ],
  },
  "gift-cards": {
    subtitle: "How to buy or sell gift cards on ORYNO",
    steps: [
      "Use the Sell or Buy tab at the top — Sell is the default.",
      "Sell: pick a brand, enter the code or upload photos, and get wallet credit in your currency.",
      "Buy: pick a product and amount, pay from your wallet, and receive the code.",
      "Every trade appears in History with a receipt you can revisit anytime.",
    ],
  },
  betting: {
    subtitle: "Follow these steps to fund a betting wallet",
    steps: [
      "Bookmakers match your account country (Nigeria, Ghana, Kenya, or South Africa).",
      "Fund your ORYNO wallet first if your balance is low.",
      "Pick a bookmaker, then enter the betting account ID.",
      "Enter the betting account ID and verify the customer name.",
      "Choose an amount, pay from your wallet, and keep the History receipt.",
    ],
  },
  catalog: {
    subtitle: "How to find and use ORYNO services",
    steps: [
      "Search or filter by category to find what you need.",
      "Open a service, follow the on-page steps, and pay from your wallet.",
      "Fund your wallet first if your balance is low.",
      "Every purchase appears in History with a receipt you can revisit anytime.",
    ],
  },
};
