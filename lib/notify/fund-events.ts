import { createNotification } from "@/lib/notifications-service";

export async function notifyWalletFunded(input: {
  userId: string;
  amountFormatted: string;
  reference: string;
  transactionId?: string;
  fundingId?: string;
  href?: string;
}) {
  const reference = input.reference.trim() || input.transactionId || "—";

  await createNotification({
    userId: input.userId,
    title: "Wallet funded successfully",
    body: `${input.amountFormatted} is now in your wallet.`,
    type: "fund",
    metadata: {
      href: input.href || "/cards",
      amountFormatted: input.amountFormatted,
      reference,
      transactionId: input.transactionId,
      fundingId: input.fundingId,
    },
  });
}
