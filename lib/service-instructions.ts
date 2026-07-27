export type ServiceInstructionId =
  | "airtime"
  | "data"
  | "bills"
  | "social"
  | "virtual-numbers"
  | "emails"
  | "gift-cards"
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
      "Bill payments currently run on VTpass for Nigeria accounts.",
      "Choose TV or electricity, then pick your provider (e.g. DStv, IKEDC).",
      "Enter your smartcard / meter number and verify the customer name.",
      "Select a package or amount, then pay from your wallet.",
      "Keep the receipt from History in case the provider needs a reference.",
    ],
  },
  social: {
    subtitle: "Follow these steps to boost your social account",
    steps: [
      "Choose the platform (Instagram, TikTok, YouTube, and more).",
      "Pick a package for followers, likes, views, or other metrics.",
      "Paste your public profile or post link exactly as shown on the app.",
      "Confirm and pay from your wallet — delivery starts within the stated ETA.",
      "Keep your account public while the order is processing.",
    ],
  },
  "virtual-numbers": {
    subtitle: "Follow these steps to get an SMS verification number",
    steps: [
      "Fund your wallet — numbers are charged at purchase.",
      "Select the service you need the number for (Telegram, WhatsApp, etc.).",
      "Pick a country with stock available (flags show each market).",
      "Pay from your wallet to reserve the number, then copy it into the app.",
      "Stay on the page — the SMS code appears here when HeroSMS receives it.",
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
    subtitle: "What to expect when gift cards launch",
    steps: [
      "Browse the brands that will be available at launch.",
      "Tap Notify me to get an alert when buy & sell goes live.",
      "After launch, you’ll fund your wallet and trade at live rates.",
      "Until then, use Airtime, Data, Numbers, or Emails from All Services.",
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
