import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { ensureDefaultTestimonials } from "@/lib/testimonials/seed";
import { getApprovedTestimonials } from "@/lib/testimonials/load";

async function main() {
  await ensureWalletSchema();
  await ensureDefaultTestimonials();
  const data = await getApprovedTestimonials();
  console.log("seeded_count", data.stats.count, "avg", data.stats.averageRating);
  console.log(data.reviews.map((r) => r.authorName).join(", "));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
