import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usdVirtualCardWaitlist } from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import { USD_CARD_ISSUER } from "@/lib/support/config";

export async function getUsdCardWaitlistStatus(userId: string) {
  const row = await db.query.usdVirtualCardWaitlist.findFirst({
    where: eq(usdVirtualCardWaitlist.userId, userId),
  });
  return {
    joined: Boolean(row),
    joinedAt: row?.createdAt?.toISOString() ?? null,
    provider: USD_CARD_ISSUER,
  };
}

export async function joinUsdCardWaitlist(input: {
  userId: string;
  fullName: string;
  email: string;
  countryCode?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required to join the waitlist.");

  const existing = await db.query.usdVirtualCardWaitlist.findFirst({
    where: eq(usdVirtualCardWaitlist.email, email),
  });
  if (existing) {
    if (!existing.userId) {
      await db
        .update(usdVirtualCardWaitlist)
        .set({ userId: input.userId, updatedAt: new Date() })
        .where(eq(usdVirtualCardWaitlist.id, existing.id));
    }
    return { created: false, joined: true };
  }

  await db.insert(usdVirtualCardWaitlist).values({
    userId: input.userId,
    email,
    countryCode: input.countryCode || null,
    provider: "maplerad",
  });

  try {
    await createNotification({
      userId: input.userId,
      title: "You’re on the USD card waitlist",
      body: `Hi ${input.fullName.split(" ")[0] || "there"}, we’ll notify you the moment ${USD_CARD_ISSUER} USD virtual cards launch in your country.`,
      type: "promo",
      metadata: { href: "/wallet", kind: "usd_card_waitlist" },
      email: false,
      push: true,
    });
  } catch (error) {
    console.error("[usd-card-waitlist-notify]", error);
  }

  return { created: true, joined: true };
}
