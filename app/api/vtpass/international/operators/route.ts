import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  cleanNetworkName,
  getIntlAirtimeOperators,
  isVtpassDemoMode,
} from "@/lib/vtpass";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const productTypeId = searchParams.get("product_type_id");
    if (!code || !productTypeId) {
      return NextResponse.json(
        { error: "code and product_type_id are required" },
        { status: 400 },
      );
    }

    const operators = isVtpassDemoMode()
      ? [
          {
            operator_id: "5",
            name: `${code} Demo Operator`,
            operator_image:
              "https://sandbox.vtpass.com/resources/images/operators/80.png",
          },
        ]
      : await getIntlAirtimeOperators(code, productTypeId);

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      code,
      productTypeId,
      operators: operators.map((op) => ({
        ...op,
        name: cleanNetworkName(op.name),
      })),
    });
  } catch (error) {
    console.error("[vtpass-intl-operators]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load operators",
      },
      { status: 400 },
    );
  }
}
