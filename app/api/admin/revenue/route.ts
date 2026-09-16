import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  COMPANY_CHARGE_SOURCES,
  DEFAULT_COMPANY_CHARGES,
  getCompanyCharges,
  saveCompanyCharges,
  type CompanyChargesConfig,
} from "@/lib/company/charges";
import {
  getCompanyRevenueSummary,
  requestCompanyPayout,
} from "@/lib/company/revenue";
import { db } from "@/lib/db";
import { countries } from "@/lib/db/schema";
import { getUsdMidRate } from "@/lib/fx/rates";
import { SUPPORTED_COUNTRIES } from "@/lib/country";

export const runtime = "nodejs";

const SOURCE_LABELS: Record<string, string> = {
  fx_conversion: "Currency conversion",
  gift_card_buy: "Gift cards (buy)",
  gift_card_sell: "Gift cards (sell)",
  virtual_number: "Virtual numbers",
  social: "Social boosting",
  email: "Temporary emails",
  withdraw: "Withdrawals",
  betting: "Betting funding",
};

async function liveRatesForCharges(config: CompanyChargesConfig) {
  const rows = await db.select().from(countries);
  const byCurrency = new Map<string, { code: string; name: string; symbol: string }>();
  for (const country of Object.values(SUPPORTED_COUNTRIES)) {
    byCurrency.set(country.currency, {
      code: country.code,
      name: country.name,
      symbol: country.currencySymbol,
    });
  }
  for (const row of rows) {
    if (!byCurrency.has(row.currency)) {
      byCurrency.set(row.currency, {
        code: row.code,
        name: row.name,
        symbol: row.currencySymbol,
      });
    }
  }
  for (const code of Object.keys(config.fx.currencies)) {
    if (!byCurrency.has(code)) {
      byCurrency.set(code, { code, name: code, symbol: code });
    }
  }

  const rates = [];
  for (const [currency, meta] of byCurrency) {
    if (currency === "USD") continue;
    let midRate = 0;
    let provider = "unavailable";
    try {
      const mid = await getUsdMidRate(currency);
      midRate = mid.midRate;
      provider = mid.provider;
    } catch {
      midRate = 0;
    }
    const override = config.fx.currencies[currency] ?? {
      buyRate: null,
      sellRate: null,
      spreadPercent: null,
    };
    const spread =
      (override.spreadPercent ?? config.fx.defaultSpreadPercent) / 100;
    const customerBuy = override.buyRate ?? (midRate > 0 ? midRate * (1 + spread) : 0);
    const customerSell =
      override.sellRate ?? (midRate > 0 ? midRate * (1 - spread) : 0);
    rates.push({
      currency,
      countryCode: meta.code,
      countryName: meta.name,
      symbol: meta.symbol,
      midRate,
      provider,
      buyRate: override.buyRate,
      sellRate: override.sellRate,
      spreadPercent: override.spreadPercent,
      customerBuy,
      customerSell,
      profitPerUsdBuy: Math.max(0, customerBuy - midRate),
      profitPerUsdSell: Math.max(0, midRate - customerSell),
    });
  }

  return rates.sort((a, b) => a.countryName.localeCompare(b.countryName));
}

export async function GET() {
  return withAdminApi(async () => {
    const [config, summary] = await Promise.all([
      getCompanyCharges(true),
      getCompanyRevenueSummary(),
    ]);
    const fxRates = await liveRatesForCharges(config);
    return NextResponse.json({
      ok: true,
      config,
      defaults: DEFAULT_COMPANY_CHARGES,
      sources: COMPANY_CHARGE_SOURCES.map((id) => ({
        id,
        label: SOURCE_LABELS[id] || id,
        silent: id !== "withdraw",
      })),
      fxRates,
      summary,
    });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async ({ admin }) => {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      config?: CompanyChargesConfig;
      payout?: {
        currency?: string;
        amount?: number;
        destinationLabel?: string;
        bankName?: string;
        accountName?: string;
        accountNumber?: string;
        bankCode?: string;
        notes?: string;
        sendViaGateway?: boolean;
      };
    };

    if (body.action === "save_charges" && body.config) {
      const config = await saveCompanyCharges(body.config);
      await writeAdminAudit({
        adminId: admin.id,
        action: "revenue.charges_update",
        entityType: "company_charges",
        entityId: "company_charges",
        meta: {
          withdrawFeeNgn: config.withdrawFeeNgn,
          currencies: Object.keys(config.fx.currencies),
          virtualNumberCountries: Object.keys(
            config.virtualNumberByCountry || {},
          ),
        },
      });
      return NextResponse.json({ ok: true, config });
    }

    if (body.action === "payout" && body.payout) {
      const payout = await requestCompanyPayout({
        adminId: admin.id,
        currency: body.payout.currency || "NGN",
        amount: Number(body.payout.amount),
        destinationLabel: body.payout.destinationLabel,
        bankName: body.payout.bankName,
        accountName: body.payout.accountName,
        accountNumber: body.payout.accountNumber,
        bankCode: body.payout.bankCode,
        notes: body.payout.notes,
        sendViaGateway: Boolean(body.payout.sendViaGateway),
      });
      await writeAdminAudit({
        adminId: admin.id,
        action: "revenue.payout",
        entityType: "company_payout",
        entityId: payout.id,
        meta: {
          currency: payout.currency,
          amount: payout.amount,
          status: payout.status,
        },
      });
      return NextResponse.json({ ok: true, payout });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  });
}
