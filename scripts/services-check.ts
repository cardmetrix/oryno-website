/**
 * Catalog + security smoke check for ORYNO services (all markets).
 * Run: pnpm check:services
 */
import { BEST_PROVIDER_BY_SERVICE } from "../lib/country-providers";
import { GHANA_BILL_PRESETS, listHubtelBillServices } from "../lib/hubtel";
import {
  KENYA_BILL_PRESETS,
  listKenyaBillServices,
  ZA_BILL_PRESETS,
  listZaBillServices,
} from "../lib/reloadly/utilities";
import { ZA_DATA_OPERATORS, ZA_DATA_PLANS } from "../lib/vtpass/za-data";
import { refundFailedDebit, reverseCompletedDebit } from "../lib/wallet/ledger";
import { withUserActionLock } from "../lib/wallet/action-lock";

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function assert(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`ok    ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function main() {
  const countries = ["NG", "GH", "KE", "ZA"] as const;

  for (const code of countries) {
    const map = BEST_PROVIDER_BY_SERVICE[code];
    assert(
      `${code} provider map`,
      Boolean(map.airtime && map.data && map.bills && map.wallet),
      `airtime=${map.airtime} data=${map.data} bills=${map.bills} wallet=${map.wallet}`,
    );
  }

  assert("NG bills", BEST_PROVIDER_BY_SERVICE.NG.bills === "sogo");
  assert("GH bills", BEST_PROVIDER_BY_SERVICE.GH.bills === "hubtel");
  assert("KE bills", BEST_PROVIDER_BY_SERVICE.KE.bills === "reloadly");
  assert("ZA bills", BEST_PROVIDER_BY_SERVICE.ZA.bills === "reloadly");

  const ghTv = listHubtelBillServices("tv-subscription");
  const ghPower = listHubtelBillServices("electricity-bill");
  const ghWater = listHubtelBillServices("water-bill");
  assert("GH TV catalog", ghTv.length > 0, `${ghTv.length} providers`);
  assert("GH electricity catalog", ghPower.length > 0, `${ghPower.length} providers`);
  assert("GH water catalog", ghWater.length > 0, `${ghWater.length} providers`);
  assert("GH presets", GHANA_BILL_PRESETS.length >= 3);

  const keTv = listKenyaBillServices("tv-subscription");
  const kePower = listKenyaBillServices("electricity-bill");
  const keWater = listKenyaBillServices("water-bill");
  assert("KE TV catalog", keTv.length > 0, `${keTv.length} providers`);
  assert("KE electricity catalog", kePower.length > 0);
  assert("KE water catalog", keWater.length > 0);
  assert("KE presets", KENYA_BILL_PRESETS.length >= 3);

  const zaTv = listZaBillServices("tv-subscription");
  const zaPower = listZaBillServices("electricity-bill");
  const zaWater = listZaBillServices("water-bill");
  assert("ZA TV catalog", zaTv.length > 0, `${zaTv.length} providers`);
  assert("ZA electricity catalog", zaPower.length > 0, `${zaPower.length} providers`);
  assert("ZA water catalog", zaWater.length > 0);
  assert("ZA presets", ZA_BILL_PRESETS.length >= 3);
  assert(
    "ZA data operators",
    ZA_DATA_OPERATORS.length === 4,
    ZA_DATA_OPERATORS.map((o) => o.name).join(", "),
  );
  assert(
    "ZA data plans",
    Object.values(ZA_DATA_PLANS).every((plans) => plans.length > 0),
  );

  assert(
    "ledger refund API",
    typeof refundFailedDebit === "function" &&
      typeof reverseCompletedDebit === "function",
  );
  assert("action lock API", typeof withUserActionLock === "function");

  const failed = checks.filter((c) => !c.ok);
  console.log("");
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main();
