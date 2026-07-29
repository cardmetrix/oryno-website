/**
 * Demo service catalog shaped for country configuration.
 * UI reads from the active country config — no hardcoded country branching.
 */

export type ServiceProvider = {
  id: string;
  name: string;
  category: string;
  description?: string;
  accent?: string;
};

export type VirtualNumberOffer = {
  id: string;
  countryCode: string;
  countryName: string;
  flag: string;
  type: "Buy" | "Rent";
  category: string;
  price: number;
  duration: string;
  smsCapable: boolean;
};

/** Temporary email rentals (HeroSMS-style verification inboxes) */
export type EmailRentOffer = {
  id: string;
  provider: string;
  domain: string;
  category: string;
  price: number;
  duration: string;
  /** Platforms this inbox works well with */
  worksFor: string[];
  popular?: boolean;
};

export type SocialPackage = {
  id: string;
  platform: string;
  name: string;
  metric: string;
  quantity: string;
  price: number;
  delivery: string;
  popular?: boolean;
};

export type GiftCardBrand = {
  id: string;
  name: string;
  category: string;
  color: string;
  /** Path under /public, e.g. /gift-cards/amazon.png */
  image: string;
};

export type CountryServiceConfig = {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  billProviders: ServiceProvider[];
  socialPackages: SocialPackage[];
  virtualNumbers: VirtualNumberOffer[];
  emailRentals: EmailRentOffer[];
  giftCardBrands: GiftCardBrand[];
  giftCardsEnabled: boolean;
};

/** Active demo config — swap/add countries via config, not code rewrites */
/**
 * Demo catalog seeded for Nigeria.
 * Live currency/country for the signed-in user comes from `useCountry()`.
 */
export const activeCountryConfig: CountryServiceConfig = {
  code: "NG",
  name: "Nigeria",
  currency: "NGN",
  currencySymbol: "₦",
  giftCardsEnabled: true,
  billProviders: [
    {
      id: "dstv",
      name: "DStv",
      category: "TV",
      description: "MultiChoice DStv subscriptions",
      accent: "#0066FF",
    },
    {
      id: "gotv",
      name: "GOtv",
      category: "TV",
      description: "GOtv bouquet renewals",
      accent: "#00A651",
    },
    {
      id: "startimes",
      name: "Startimes",
      category: "TV",
      description: "Startimes TV packages",
      accent: "#E31C23",
    },
    {
      id: "showmax",
      name: "Showmax",
      category: "TV",
      description: "Showmax subscription",
      accent: "#E50914",
    },
    {
      id: "ikeja-electric",
      name: "IKEDC",
      category: "Electricity",
      description: "Ikeja Electric prepaid & postpaid",
      accent: "#FF6A00",
    },
    {
      id: "eko-electric",
      name: "EKEDC",
      category: "Electricity",
      description: "Eko Electricity Distribution",
      accent: "#FF8C42",
    },
    {
      id: "abuja-electric",
      name: "AEDC",
      category: "Electricity",
      description: "Abuja Electricity Distribution",
      accent: "#FFCC00",
    },
    {
      id: "kano-electric",
      name: "KEDCO",
      category: "Electricity",
      description: "Kano Electric",
      accent: "#1C1C1E",
    },
    {
      id: "portharcourt-electric",
      name: "PHED",
      category: "Electricity",
      description: "Port Harcourt Electric",
      accent: "#0066FF",
    },
    {
      id: "jos-electric",
      name: "JED",
      category: "Electricity",
      description: "Jos Electric",
      accent: "#50B848",
    },
    {
      id: "ibadan-electric",
      name: "IBEDC",
      category: "Electricity",
      description: "Ibadan Electricity",
      accent: "#ED1C24",
    },
    {
      id: "kaduna-electric",
      name: "KAEDCO",
      category: "Electricity",
      description: "Kaduna Electric",
      accent: "#FF6A00",
    },
    {
      id: "enugu-electric",
      name: "EEDC",
      category: "Electricity",
      description: "Enugu Electric",
      accent: "#006F2D",
    },
    {
      id: "benin-electric",
      name: "BEDC",
      category: "Electricity",
      description: "Benin Electricity",
      accent: "#FF8C42",
    },
    {
      id: "aba-electric",
      name: "APLE",
      category: "Electricity",
      description: "Aba Electric",
      accent: "#1C1C1E",
    },
    {
      id: "yola-electric",
      name: "YEDC",
      category: "Electricity",
      description: "Yola Electric Disco",
      accent: "#0066FF",
    },
  ],
  socialPackages: [
    {
      id: "ig-1k",
      platform: "Instagram",
      name: "Starter Boost",
      metric: "Followers",
      quantity: "1,000",
      price: 2500,
      delivery: "6–24 hrs",
      popular: true,
    },
    {
      id: "ig-likes",
      platform: "Instagram",
      name: "Likes Pack",
      metric: "Likes",
      quantity: "2,500",
      price: 1800,
      delivery: "1–6 hrs",
    },
    {
      id: "tt-1k",
      platform: "TikTok",
      name: "Views Surge",
      metric: "Views",
      quantity: "10,000",
      price: 3000,
      delivery: "2–12 hrs",
      popular: true,
    },
    {
      id: "tt-followers",
      platform: "TikTok",
      name: "Follower Grow",
      metric: "Followers",
      quantity: "500",
      price: 3500,
      delivery: "12–48 hrs",
    },
    {
      id: "yt-subs",
      platform: "YouTube",
      name: "Subscriber Lift",
      metric: "Subscribers",
      quantity: "200",
      price: 4500,
      delivery: "24–72 hrs",
    },
    {
      id: "yt-views",
      platform: "YouTube",
      name: "Watch Boost",
      metric: "Views",
      quantity: "5,000",
      price: 2800,
      delivery: "6–24 hrs",
      popular: true,
    },
    {
      id: "x-followers",
      platform: "X",
      name: "Audience Pack",
      metric: "Followers",
      quantity: "500",
      price: 2200,
      delivery: "12–36 hrs",
    },
    {
      id: "fb-likes",
      platform: "Facebook",
      name: "Page Likes",
      metric: "Likes",
      quantity: "1,000",
      price: 2000,
      delivery: "12–48 hrs",
    },
  ],
  virtualNumbers: [
    {
      id: "us-buy-sms",
      countryCode: "US",
      countryName: "United States",
      flag: "🇺🇸",
      type: "Buy",
      category: "SMS Verification",
      price: 4500,
      duration: "Permanent",
      smsCapable: true,
    },
    {
      id: "us-rent-sms",
      countryCode: "US",
      countryName: "United States",
      flag: "🇺🇸",
      type: "Rent",
      category: "SMS Verification",
      price: 800,
      duration: "24 hours",
      smsCapable: true,
    },
    {
      id: "uk-rent-sms",
      countryCode: "GB",
      countryName: "United Kingdom",
      flag: "🇬🇧",
      type: "Rent",
      category: "SMS Verification",
      price: 1200,
      duration: "24 hours",
      smsCapable: true,
    },
    {
      id: "ca-buy",
      countryCode: "CA",
      countryName: "Canada",
      flag: "🇨🇦",
      type: "Buy",
      category: "Voice + SMS",
      price: 6500,
      duration: "Permanent",
      smsCapable: true,
    },
    {
      id: "ng-rent",
      countryCode: "NG",
      countryName: "Nigeria",
      flag: "🇳🇬",
      type: "Rent",
      category: "SMS Verification",
      price: 500,
      duration: "24 hours",
      smsCapable: true,
    },
    {
      id: "za-rent",
      countryCode: "ZA",
      countryName: "South Africa",
      flag: "🇿🇦",
      type: "Rent",
      category: "SMS Verification",
      price: 900,
      duration: "24 hours",
      smsCapable: true,
    },
  ],
  emailRentals: [
    {
      id: "email-any-10m",
      provider: "Any mailbox",
      domain: "random",
      category: "Quick OTP",
      price: 200,
      duration: "10 minutes",
      worksFor: ["Any service"],
      popular: true,
    },
    {
      id: "email-any-1h",
      provider: "Any mailbox",
      domain: "random",
      category: "Standard OTP",
      price: 350,
      duration: "1 hour",
      worksFor: ["Any service"],
      popular: true,
    },
    {
      id: "email-gmail-1h",
      provider: "Gmail-style",
      domain: "gmail.com",
      category: "Google / apps",
      price: 800,
      duration: "1 hour",
      worksFor: ["Google", "Discord", "OpenAI"],
    },
    {
      id: "email-outlook-1h",
      provider: "Outlook-style",
      domain: "outlook.com",
      category: "Microsoft / apps",
      price: 750,
      duration: "1 hour",
      worksFor: ["Microsoft", "LinkedIn", "GitHub"],
    },
    {
      id: "email-any-24h",
      provider: "Any mailbox",
      domain: "random",
      category: "Extended rental",
      price: 1200,
      duration: "24 hours",
      worksFor: ["Any service"],
    },
    {
      id: "email-custom-24h",
      provider: "Premium domain",
      domain: "custom",
      category: "High deliverability",
      price: 2500,
      duration: "24 hours",
      worksFor: ["Banks", "Crypto", "Marketplaces"],
      popular: true,
    },
  ],
  giftCardBrands: [
    {
      id: "amazon",
      name: "Amazon",
      category: "Shopping",
      color: "#FF9900",
      image: "/gift-cards/amazon.png",
    },
    {
      id: "apple",
      name: "Apple",
      category: "Apps & Media",
      color: "#1C1C1E",
      image: "/gift-cards/apple.png",
    },
    {
      id: "google-play",
      name: "Google Play",
      category: "Apps & Games",
      color: "#34A853",
      image: "/gift-cards/google-play.png",
    },
    {
      id: "steam",
      name: "Steam",
      category: "Gaming",
      color: "#1B2838",
      image: "/gift-cards/steam.png",
    },
    {
      id: "playstation",
      name: "PlayStation",
      category: "Gaming",
      color: "#003087",
      image: "/gift-cards/playstation.png",
    },
    {
      id: "xbox",
      name: "Xbox",
      category: "Gaming",
      color: "#107C10",
      image: "/gift-cards/xbox.png",
    },
    {
      id: "roblox",
      name: "Roblox",
      category: "Gaming",
      color: "#E2231A",
      image: "/gift-cards/roblox.svg",
    },
    {
      id: "razer-gold",
      name: "Razer Gold",
      category: "Gaming",
      color: "#44D62C",
      image: "/gift-cards/razer-gold.svg",
    },
    {
      id: "netflix",
      name: "Netflix",
      category: "Streaming",
      color: "#E50914",
      image: "/gift-cards/netflix.png",
    },
    {
      id: "spotify",
      name: "Spotify",
      category: "Music",
      color: "#1DB954",
      image: "/gift-cards/spotify.png",
    },
    {
      id: "sephora",
      name: "Sephora",
      category: "Beauty",
      color: "#000000",
      image: "/gift-cards/sephora.svg",
    },
    {
      id: "nike",
      name: "Nike",
      category: "Fashion",
      color: "#111111",
      image: "/gift-cards/nike.svg",
    },
    {
      id: "walmart",
      name: "Walmart",
      category: "Shopping",
      color: "#0071CE",
      image: "/gift-cards/walmart.svg",
    },
    {
      id: "target",
      name: "Target",
      category: "Shopping",
      color: "#CC0000",
      image: "/gift-cards/target.svg",
    },
    {
      id: "best-buy",
      name: "Best Buy",
      category: "Shopping",
      color: "#0046BE",
      image: "/gift-cards/best-buy.svg",
    },
    {
      id: "ebay",
      name: "eBay",
      category: "Shopping",
      color: "#E53238",
      image: "/gift-cards/ebay.svg",
    },
    {
      id: "visa",
      name: "Visa",
      category: "Prepaid",
      color: "#1A1F71",
      image: "/gift-cards/visa.svg",
    },
    {
      id: "amex",
      name: "Amex",
      category: "Prepaid",
      color: "#006FCF",
      image: "/gift-cards/amex.svg",
    },
  ],
};

export function formatMoney(
  value: number,
  symbol = activeCountryConfig.currencySymbol,
) {
  return `${symbol}${value.toLocaleString("en-NG")}`;
}

export const billCategories = ["All", "Electricity", "TV"] as const;
export const socialPlatforms = [
  "All",
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "Facebook",
] as const;
