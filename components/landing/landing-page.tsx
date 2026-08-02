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
    label: "Home",
    alt: "ORYNO home dashboard with wallet balance and quick actions",
    file: "home.png",
  },
  {
    label: "Wallet",
    alt: "ORYNO wallet with NGN balance and bank accounts",
    file: "wallet.png",
  },
  {
    label: "Gift Cards",
    alt: "ORYNO gift card sell screen with live Amazon rates",
    file: "gift-cards.png",
  },
  {
    label: "Live Rates",
    alt: "ORYNO gift card live sell rates list",
    file: "gift-cards-live.png",
  },
  {
    label: "Buy Data",
    alt: "ORYNO buy data plans with network selection",
    file: "data.png",
  },
  {
    label: "Bill Payments",
    alt: "ORYNO bill payments for TV subscriptions",
    file: "bills.png",
  },
  {
    label: "Virtual Numbers",
    alt: "ORYNO virtual numbers for SMS verification",
    file: "virtual-numbers.png",
  },
  {
    label: "Rent Email",
    alt: "ORYNO temporary email rental for OTP and sign-ups",
    file: "emails.png",
  },
] as const;

export function LandingPage() {
  const homeSrc = screenshotSrc("home.png");
  const walletSrc = screenshotSrc("wallet.png");
  const shots = GALLERY.map((shot) => ({
    ...shot,
    src: screenshotSrc(shot.file),
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
