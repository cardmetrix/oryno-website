import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { giftCardWaitlist, users } from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";

const HREF = "/services/international-gifting";
const KIND = "international_gifting_waitlist";

export async function getInternationalGiftingWaitlistStatus(userId: string) {
  const row = await db.query.giftCardWaitlist.findFirst({
    where: eq(giftCardWaitlist.userId, userId),
  });
  return {
    joined: Boolean(row),
    joinedAt: row?.createdAt?.toISOString() ?? null,
  };
}

export async function joinInternationalGiftingWaitlist(input: {
  userId: string;
  fullName: string;
  email: string;
  countryCode?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required to join the waitlist.");

  const existingByEmail = await db.query.giftCardWaitlist.findFirst({
    where: eq(giftCardWaitlist.email, email),
  });
  if (existingByEmail) {
    if (!existingByEmail.userId || existingByEmail.userId !== input.userId) {
      await db
        .update(giftCardWaitlist)
        .set({
          userId: input.userId,
          countryCode: input.countryCode || existingByEmail.countryCode,
          updatedAt: new Date(),
        })
        .where(eq(giftCardWaitlist.id, existingByEmail.id));
    }
    return { created: false as const, joined: true as const };
  }

  const existingByUser = await db.query.giftCardWaitlist.findFirst({
    where: eq(giftCardWaitlist.userId, input.userId),
  });
  if (existingByUser) {
    return { created: false as const, joined: true as const };
  }

  await db.insert(giftCardWaitlist).values({
    userId: input.userId,
    email,
    countryCode: input.countryCode || null,
  });

  const firstName = input.fullName.split(" ")[0] || "there";
  try {
    await createNotification({
      userId: input.userId,
      title: "You're on the International Gifting waitlist",
      body: `Hi ${firstName}, thanks for joining. We'll email and notify you when International Gifting launches.`,
      type: "promo",
      metadata: { href: HREF, kind: KIND },
      email: true,
      push: true,
    });
  } catch (error) {
    console.error("[international-gifting-waitlist-notify]", error);
  }

  return { created: true as const, joined: true as const };
}

export async function leaveInternationalGiftingWaitlist(userId: string) {
  const deleted = await db
    .delete(giftCardWaitlist)
    .where(eq(giftCardWaitlist.userId, userId))
    .returning({ id: giftCardWaitlist.id });
  return { removed: deleted.length > 0 };
}

export async function listInternationalGiftingWaitlist(limit = 500) {
  const rows = await db
    .select({
      id: giftCardWaitlist.id,
      email: giftCardWaitlist.email,
      countryCode: giftCardWaitlist.countryCode,
      notifiedAt: giftCardWaitlist.notifiedAt,
      createdAt: giftCardWaitlist.createdAt,
      userName: users.fullName,
      userId: giftCardWaitlist.userId,
    })
    .from(giftCardWaitlist)
    .leftJoin(users, eq(giftCardWaitlist.userId, users.id))
    .orderBy(desc(giftCardWaitlist.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.userName || "-",
    userId: row.userId,
    countryCode: row.countryCode,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    joinedAt: row.createdAt.toISOString(),
  }));
}

export async function removeInternationalGiftingWaitlistEntries(ids: string[]) {
  if (ids.length === 0) return { removed: 0 };
  const deleted = await db
    .delete(giftCardWaitlist)
    .where(inArray(giftCardWaitlist.id, ids))
    .returning({ id: giftCardWaitlist.id });
  return { removed: deleted.length };
}

export async function notifyInternationalGiftingWaitlist(input: {
  ids?: string[];
  title?: string;
  body?: string;
  onlyUnnotified?: boolean;
}) {
  const title =
    input.title?.trim() || "International Gifting is almost here";
  const body =
    input.body?.trim() ||
    "Thanks for waiting - open International Gifting in ORYNO to get updates when we go live.";

  const onlyUnnotified = input.onlyUnnotified !== false;

  let rows: (typeof giftCardWaitlist.$inferSelect)[];
  if (input.ids?.length) {
    rows = await db.query.giftCardWaitlist.findMany({
      where: inArray(giftCardWaitlist.id, input.ids),
      limit: 500,
    });
  } else if (onlyUnnotified) {
    rows = await db.query.giftCardWaitlist.findMany({
      where: isNull(giftCardWaitlist.notifiedAt),
      limit: 500,
    });
  } else {
    rows = await db.query.giftCardWaitlist.findMany({ limit: 500 });
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
        metadata: { href: HREF, kind: `${KIND}_launch` },
        email: true,
        push: true,
      });
      await db
        .update(giftCardWaitlist)
        .set({ notifiedAt: now, updatedAt: now })
        .where(eq(giftCardWaitlist.id, row.id));
      notified += 1;
    } catch (error) {
      console.error("[international-gifting-waitlist-launch]", row.id, error);
      skipped += 1;
    }
  }

  return { notified, skipped, total: rows.length };
}
