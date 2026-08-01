import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fetchReloadlyProduct,
  fetchReloadlyProducts,
  isReloadlyDemoMode,
  isReloadlySandbox,
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

    console.log("[reloadly-products]", {
      countryCode,
      q,
      productId: productId || undefined,
      demo: isReloadlyDemoMode(),
      sandbox: isReloadlySandbox(),
    });

    // Quote a specific product amount
    if (productId > 0 && unitPrice > 0) {
      let product =
        (await fetchReloadlyProduct(productId)) ||
        (await fetchReloadlyProducts({ countryCode })).find(
          (p) => p.productId === productId,
        ) ||
        null;

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      const quote = await quoteGiftCardBuy({
        product,
        unitPrice,
        countryCode: user.countryCode,
      });

      return NextResponse.json({
        ok: true,
        product,
        quote,
        demo: isReloadlyDemoMode(),
        sandbox: isReloadlySandbox(),
      });
    }

    const products = await fetchReloadlyProducts({
      countryCode,
      productName: q || undefined,
    });

    console.log("[reloadly-products] ok", {
      countryCode,
      count: products.length,
      demo: isReloadlyDemoMode(),
    });

    return NextResponse.json({
      ok: true,
      products,
      count: products.length,
      demo: isReloadlyDemoMode(),
      sandbox: isReloadlySandbox(),
      countryCode,
    });
  } catch (error) {
    console.error("[reloadly-products] failed", error);
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
