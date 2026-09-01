export {
  createOrReuseTransferRecipient,
  listFlutterwaveBanks as listPaystackBanks,
  listPayoutBanks,
  resolveBankAccount,
  type FlutterwaveBankOption as PaystackBankOption,
  DEMO_BANK_OPTIONS,
} from "@/lib/flutterwave/banks";

export async function listNigerianBanks() {
  const { listFlutterwaveBanks } = await import("@/lib/flutterwave/banks");
  return listFlutterwaveBanks("NG");
}
