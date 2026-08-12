import { getLandingAssetMap } from "@/lib/landing/seed";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { screenshotSrc } from "@/lib/screenshots";
import { Download } from "./download";
import { Features } from "./features";
import { Hero } from "./hero";
import { Screenshots } from "./screenshots";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WalletSection } from "./wallet";

const GALLERY = [
  {
    slot: "gallery_home" as const,
    label: "Home",
    alt: "ORYNO home dashboard with wallet balance and quick actions",
    file: "home.png",
  },
  {
    slot: "gallery_wallet" as const,
    label: "Wallet",
    alt: "ORYNO wallet with NGN balance and bank accounts",
    file: "wallet.png",
  },
  {
    slot: "gallery_gift_cards" as const,
    label: "Gift Cards",
    alt: "ORYNO gift card sell screen with live Amazon rates",
    file: "gift-cards.png",
  },
  {
    slot: "gallery_gift_cards_live" as const,
    label: "Live Rates",
    alt: "ORYNO gift card live sell rates list",
    file: "gift-cards-live.png",
  },
  {
    slot: "gallery_data" as const,
    label: "Buy Data",
    alt: "ORYNO buy data plans with network selection",
    file: "data.png",
  },
  {
    slot: "gallery_bills" as const,
    label: "Bill Payments",
    alt: "ORYNO bill payments for TV subscriptions",
    file: "bills.png",
  },
  {
    slot: "gallery_virtual_numbers" as const,
    label: "Virtual Numbers",
    alt: "ORYNO virtual numbers for SMS verification",
    file: "virtual-numbers.png",
  },
  {
    slot: "gallery_emails" as const,
    label: "Rent Email",
    alt: "ORYNO temporary email rental for OTP and sign-ups",
    file: "emails.png",
  },
] as const;

export async function LandingPage() {
  let assets: Awaited<ReturnType<typeof getLandingAssetMap>> = {};
  try {
    await ensureWalletSchema();
    assets = await getLandingAssetMap();
  } catch {
    // fall back to local public screenshots
  }

  const homeSrc =
    assets.hero_home || screenshotSrc("home.png");
  const walletSrc =
    assets.hero_wallet || screenshotSrc("wallet.png");
  const shots = GALLERY.map((shot) => ({
    label: shot.label,
    alt: shot.alt,
    file: shot.file,
    src: assets[shot.slot] || screenshotSrc(shot.file),
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero homeSrc={homeSrc} walletSrc={walletSrc} />
        <Features />
        <WalletSection walletSrc={walletSrc} />
        <Screenshots shots={shots} />
        <Download />
      </main>
      <SiteFooter />
    </div>
  );
}
