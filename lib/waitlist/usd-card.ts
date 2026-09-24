import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { usdVirtualCardWaitlist, users } from "@/lib/db/schema";
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

  const existingByEmail = await db.query.usdVirtualCardWaitlist.findFirst({
    where: eq(usdVirtualCardWaitlist.email, email),
  });
  if (existingByEmail) {
    if (!existingByEmail.userId || existingByEmail.userId !== input.userId) {
      await db
        .update(usdVirtualCardWaitlist)
        .set({
          userId: input.userId,
          countryCode: input.countryCode || existingByEmail.countryCode,
          updatedAt: new Date(),
        })
        .where(eq(usdVirtualCardWaitlist.id, existingByEmail.id));
    }
    return { created: false as const, joined: true as const };
  }

  const existingByUser = await db.query.usdVirtualCardWaitlist.findFirst({
    where: eq(usdVirtualCardWaitlist.userId, input.userId),
  });
  if (existingByUser) {
    return { created: false as const, joined: true as const };
  }

  await db.insert(usdVirtualCardWaitlist).values({
    userId: input.userId,
    email,
    countryCode: input.countryCode || null,
    provider: "maplerad",
  });

  const firstName = input.fullName.split(" ")[0] || "there";
  try {
    await createNotification({
      userId: input.userId,
      title: "You're on the USD card waitlist",
      body: `Hi ${firstName}, thanks for joining. We'll email and notify you the moment ${USD_CARD_ISSUER} USD virtual cards launch.`,
      type: "promo",
      metadata: { href: "/cards", kind: "usd_card_waitlist" },
      email: true,
      push: true,
    });
  } catch (error) {
    console.error("[usd-card-waitlist-notify]", error);
  }

  return { created: true as const, joined: true as const };
}

export async function leaveUsdCardWaitlist(userId: string) {
  const deleted = await db
    .delete(usdVirtualCardWaitlist)
    .where(eq(usdVirtualCardWaitlist.userId, userId))
    .returning({ id: usdVirtualCardWaitlist.id });
  return { removed: deleted.length > 0 };
}

export async function listUsdCardWaitlist(limit = 500) {
  const rows = await db
    .select({
      id: usdVirtualCardWaitlist.id,
      email: usdVirtualCardWaitlist.email,
      countryCode: usdVirtualCardWaitlist.countryCode,
      provider: usdVirtualCardWaitlist.provider,
      notifiedAt: usdVirtualCardWaitlist.notifiedAt,
      createdAt: usdVirtualCardWaitlist.createdAt,
      userName: users.fullName,
      userId: usdVirtualCardWaitlist.userId,
    })
    .from(usdVirtualCardWaitlist)
    .leftJoin(users, eq(usdVirtualCardWaitlist.userId, users.id))
    .orderBy(desc(usdVirtualCardWaitlist.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.userName || "-",
    userId: row.userId,
    countryCode: row.countryCode,
    provider: row.provider,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    joinedAt: row.createdAt.toISOString(),
  }));
}

export async function removeUsdCardWaitlistEntries(ids: string[]) {
  if (ids.length === 0) return { removed: 0 };
  const deleted = await db
    .delete(usdVirtualCardWaitlist)
    .where(inArray(usdVirtualCardWaitlist.id, ids))
    .returning({ id: usdVirtualCardWaitlist.id });
  return { removed: deleted.length };
}

/** Notify waitlist users that cards are launching (or a custom message). */
export async function notifyUsdCardWaitlist(input: {
  ids?: string[];
  title?: string;
  body?: string;
  onlyUnnotified?: boolean;
}) {
  const title =
    input.title?.trim() ||
    `${USD_CARD_ISSUER} USD virtual cards are almost here`;
  const body =
    input.body?.trim() ||
    "Thanks for waiting - open Cards in ORYNO to get updates and be first to purchase when we go live.";

  const onlyUnnotified = input.onlyUnnotified !== false;

  let rows: (typeof usdVirtualCardWaitlist.$inferSelect)[];
  if (input.ids?.length) {
    rows = await db.query.usdVirtualCardWaitlist.findMany({
      where: inArray(usdVirtualCardWaitlist.id, input.ids),
      limit: 500,
    });
  } else if (onlyUnnotified) {
    rows = await db.query.usdVirtualCardWaitlist.findMany({
      where: isNull(usdVirtualCardWaitlist.notifiedAt),
      limit: 500,
    });
  } else {
    rows = await db.query.usdVirtualCardWaitlist.findMany({ limit: 500 });
  }

  let notified = 0;
  let skipped = 0;
  const now = new Date();

  for (const row of rows) {
    if (!row.userId) {
      skipped += 1;
      continue;
    }
    try {
      await createNotification({
        userId: row.userId,
        title,
        body,
        type: "promo",
        metadata: { href: "/cards", kind: "usd_card_waitlist_launch" },
        email: true,
        push: true,
      });
      await db
        .update(usdVirtualCardWaitlist)
        .set({ notifiedAt: now, updatedAt: now })
        .where(eq(usdVirtualCardWaitlist.id, row.id));
      notified += 1;
    } catch (error) {
      console.error("[usd-card-waitlist-launch]", row.id, error);
      skipped += 1;
    }
  }

  return { notified, skipped, total: rows.length };
}
