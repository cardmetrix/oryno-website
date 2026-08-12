import { getApprovedTestimonials } from "@/lib/testimonials/load";
import { Download } from "./download";
import { Features } from "./features";
import { Hero } from "./hero";
import { Testimonials } from "./testimonials";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WalletSection } from "./wallet";
import { getLandingAssetMap } from "@/lib/landing/seed";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { screenshotSrc } from "@/lib/screenshots";

export async function LandingPage() {
  let assets: Awaited<ReturnType<typeof getLandingAssetMap>> = {};
  let testimonials = {
    reviews: [] as Awaited<ReturnType<typeof getApprovedTestimonials>>["reviews"],
    stats: { count: 0, averageRating: 0 },
  };

  try {
    await ensureWalletSchema();
    assets = await getLandingAssetMap();
    testimonials = await getApprovedTestimonials();
  } catch {
    // fall back to bundled assets and empty reviews
  }

  const homeSrc = assets.hero_home || screenshotSrc("home.png");
  const walletSrc = assets.hero_wallet || screenshotSrc("wallet.png");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero homeSrc={homeSrc} walletSrc={walletSrc} />
        <Features />
        <WalletSection walletSrc={walletSrc} />
        <Testimonials
          reviews={testimonials.reviews}
          stats={testimonials.stats}
        />
        <Download />
      </main>
      <SiteFooter />
    </div>
  );
}
