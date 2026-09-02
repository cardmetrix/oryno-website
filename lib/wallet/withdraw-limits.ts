import {
  currencyForCountry,
  formatCountryMoney,
  resolveCountryCode,
} from "@/lib/country";
import { convertNgnToLocal } from "@/lib/fx/rates";
import { getDisplayFx } from "@/lib/display-currency";

/** Flutterwave / ORYNO minimum payout floor in NGN ledger units. */
export const MIN_WITHDRAW_NGN = 100;

export type WithdrawMinimum = {
  minNgn: number;
  minLocal: number;
  currency: string;
  countryCode: string;
  formatted: string;
  message: string;
};

export async function getWithdrawMinimum(
  countryCode?: string | null,
): Promise<WithdrawMinimum> {
  const code = resolveCountryCode(countryCode);
  const currency = currencyForCountry(code);
  const fx = await getDisplayFx(code);
  const minLocal =
    currency === "NGN"
      ? MIN_WITHDRAW_NGN
      : Math.ceil(convertNgnToLocal(MIN_WITHDRAW_NGN, fx.ngnToLocal) * 100) /
        100;

  const formatted = formatCountryMoney(minLocal, code);
  return {
    minNgn: MIN_WITHDRAW_NGN,
    minLocal,
    currency,
    countryCode: code,
    formatted,
    message: `Minimum withdrawal is ${formatted} (₦${MIN_WITHDRAW_NGN.toFixed(2)} equivalent).`,
  };
}

export function assertWithdrawMinimum(input: {
  localAmount: number;
  minLocal: number;
  message: string;
}) {
  if (input.localAmount + 1e-9 < input.minLocal) {
    throw new Error(input.message);
  }
}
