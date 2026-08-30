import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  cleanNetworkName,
  getIntlAirtimeOperators,
  isIntlDataProductType,
  isVtpassDemoMode,
  ZA_AIRTIME_OPERATORS,
  ZA_DATA_OPERATORS,
} from "@/lib/vtpass";

export const runtime = "nodejs";

const GH_OPERATORS = [
  {
    operator_id: "5",
    name: "MTN Ghana",
    operator_image:
      "https://sandbox.vtpass.com/resources/images/operators/80.png",
  },
  {
    operator_id: "6",
    name: "Telecel Ghana",
    operator_image:
      "https://sandbox.vtpass.com/resources/images/operators/80.png",
  },
  {
    operator_id: "7",
    name: "AirtelTigo Ghana",
    operator_image:
      "https://sandbox.vtpass.com/resources/images/operators/80.png",
  },
];

function zaOperators(productTypeId: string) {
  const list = isIntlDataProductType(productTypeId)
    ? ZA_DATA_OPERATORS
    : ZA_AIRTIME_OPERATORS;
  return list.map((op) => ({
    operator_id: op.operator_id,
    name: op.name,
    operator_image: op.operator_image,
    domain: op.domain,
  }));
}

function demoIntlOperators(code: string, productTypeId: string) {
  if (code === "GH") return GH_OPERATORS;
  if (code === "ZA") return zaOperators(productTypeId);
  return [
    {
      operator_id: "5",
      name: `${code} Demo Operator`,
      operator_image:
        "https://sandbox.vtpass.com/resources/images/operators/80.png",
    },
  ];
}

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

    const iso = code.toUpperCase();
    let operators: Array<{
      operator_id: string;
      name: string;
      operator_image?: string;
      domain?: string;
    }> = [];

    if (isVtpassDemoMode()) {
      operators = demoIntlOperators(iso, productTypeId);
    } else {
      try {
        operators = await getIntlAirtimeOperators(code, productTypeId);
      } catch (error) {
        console.error("[vtpass-intl-operators-live]", error);
        throw error instanceof Error
          ? error
          : new Error("Failed to load live operators");
      }
    }

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      code,
      productTypeId,
      operators: operators.map((op) => ({
        ...op,
        name: cleanNetworkName(op.name),
        domain:
          "domain" in op && typeof op.domain === "string" ? op.domain : undefined,
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
