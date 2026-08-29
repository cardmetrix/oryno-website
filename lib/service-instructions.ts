export type ServiceInstructionId =
  | "airtime"
  | "data"
  | "bills"
  | "social"
  | "virtual-numbers"
  | "emails"
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
    subtitle: "Follow these steps to pay TV or electricity bills",
    steps: [
      "Bill payments are available for Nigeria accounts.",
      "Choose TV or electricity, then pick your provider (e.g. DStv, IKEDC).",
      "Enter your smartcard / meter number and verify the customer name.",
      "Select a package or amount, then pay from your wallet.",
      "Keep the receipt from History in case you need a reference.",
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
    subtitle: "Follow these steps to get an SMS verification number",
    steps: [
      "Fund your wallet — numbers are charged at purchase.",
      "Select the service you need the number for (Telegram, WhatsApp, etc.).",
      "Pick a country with stock available (flags show each market).",
      "Pay from your wallet to reserve the number, then copy it into the app.",
      "Stay on the page — the SMS code appears here when it arrives.",
    ],
  },
  emails: {
    subtitle: "Follow these steps to rent a temporary email",
    steps: [
      "Fund your wallet before renting an inbox.",
      "Choose the site you are signing up for (e.g. Telegram, Google).",
      "Pick an available email domain and confirm the price.",
      "Pay from your wallet — copy the address into the signup form.",
      "Wait on this page for the verification code; it updates automatically.",
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
