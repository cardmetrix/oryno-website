import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  getIntlAirtimeProductTypes,
  isVtpassDemoMode,
} from "@/lib/vtpass";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const code = new URL(req.url).searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const productTypes = isVtpassDemoMode()
      ? [
          { product_type_id: 1, name: "Mobile Top Up" },
          { product_type_id: 4, name: "Mobile Data" },
        ]
      : await getIntlAirtimeProductTypes(code);

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      code,
      productTypes,
    });
  } catch (error) {
    console.error("[vtpass-intl-product-types]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load product types",
      },
      { status: 400 },
    );
  }
}
