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
    alt: "ORYNO home dashboard screenshot",
    file: "home.png",
  },
  {
    label: "Wallet",
    alt: "ORYNO wallet screenshot",
    file: "wallet.png",
  },
  {
    label: "Airtime & Data",
    alt: "ORYNO airtime and data screenshot",
    file: "airtime.png",
  },
  {
    label: "Bill Payments",
    alt: "ORYNO bill payments screenshot",
    file: "bills.png",
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
