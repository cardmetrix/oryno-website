import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fetchReloadlyProducts,
  isReloadlyDemoMode,
  quoteGiftCardBuy,
  reloadlyErrorToEnglish,
} from "@/lib/reloadly";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const countryCode = (searchParams.get("countryCode") || "US").toUpperCase();
    const q = searchParams.get("q") || searchParams.get("productName") || "";
    const productId = Number(searchParams.get("productId") || "0");
    const unitPrice = Number(searchParams.get("unitPrice") || "0");

    const products = await fetchReloadlyProducts({
      countryCode,
      productName: q || undefined,
      size: 50,
      page: 1,
    });

    if (productId > 0 && unitPrice > 0) {
      const product = products.find((p) => p.productId === productId);
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      const quote = await quoteGiftCardBuy({
        product,
        unitPrice,
        countryCode: user.countryCode,
      });
      return NextResponse.json({
        products,
        quote,
        demo: isReloadlyDemoMode(),
      });
    }

    return NextResponse.json({
      products,
      demo: isReloadlyDemoMode(),
      countryCode,
    });
  } catch (error) {
    console.error("[reloadly-products]", error);
    return NextResponse.json(
      {
        error: reloadlyErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load products",
        ),
      },
      { status: 400 },
    );
  }
}
