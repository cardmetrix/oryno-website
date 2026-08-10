import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { formatCountryMoney } from "@/lib/country";
import { db } from "@/lib/db";
import { referralEvents, users } from "@/lib/db/schema";
import {
  REFERRAL_BONUS_NGN,
  REFERRAL_MIN_TRANSACTIONS,
  referralSignupUrl,
} from "@/lib/referrals/config";
import {
  attachReferral,
  countQualifyingTransactions,
  getOrCreateUserReferralCode,
} from "@/lib/referrals/service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const codeRow = await getOrCreateUserReferralCode(user.id, user.fullName);
    const origin = new URL(req.url).origin;

    const events = await db
      .select({
        id: referralEvents.id,
        status: referralEvents.status,
        rewardAmount: referralEvents.rewardAmount,
        currency: referralEvents.currency,
        createdAt: referralEvents.createdAt,
        referredName: users.fullName,
        referredUserId: referralEvents.referredUserId,
      })
      .from(referralEvents)
      .innerJoin(users, eq(referralEvents.referredUserId, users.id))
      .where(eq(referralEvents.referrerUserId, user.id))
      .orderBy(desc(referralEvents.createdAt))
      .limit(50);

    const myReferral = await db.query.referralEvents.findFirst({
      where: eq(referralEvents.referredUserId, user.id),
    });

    let myProgress: {
      txCount: number;
      required: number;
      status: string;
      remaining: number;
    } | null = null;

    if (myReferral) {
      const txCount = await countQualifyingTransactions(user.id);
      myProgress = {
        txCount,
        required: REFERRAL_MIN_TRANSACTIONS,
        status: myReferral.status,
        remaining: Math.max(0, REFERRAL_MIN_TRANSACTIONS - txCount),
      };
    }

    const pending = events.filter((e) => e.status === "pending").length;
    const completed = events.filter((e) => e.status === "completed").length;

    return NextResponse.json({
      ok: true,
      program: {
        bonusNgn: REFERRAL_BONUS_NGN,
        bonusLabel: formatCountryMoney(REFERRAL_BONUS_NGN, "NG"),
        minTransactions: REFERRAL_MIN_TRANSACTIONS,
        description: `Invite friends with your code. When they complete ${REFERRAL_MIN_TRANSACTIONS} transactions, you both get ${formatCountryMoney(REFERRAL_BONUS_NGN, "NG")} (converted to local currency).`,
      },
      code: {
        code: codeRow.code,
        status: codeRow.status,
        joinsCount: codeRow.joinsCount,
        earnings: codeRow.earnings,
        earningsLabel: formatCountryMoney(
          Number(codeRow.earnings || 0),
          user.countryCode,
        ),
        shareUrl: referralSignupUrl(codeRow.code, origin),
      },
      stats: {
        joins: codeRow.joinsCount,
        pending,
        completed,
      },
      invites: events.map((e) => ({
        id: e.id,
        name: e.referredName,
        status: e.status,
        rewardAmount: e.rewardAmount,
        currency: e.currency,
        createdAt: e.createdAt?.toISOString?.() ?? null,
      })),
      asReferred: myProgress,
    });
  } catch (error) {
    console.error("[referrals-get]", error);
    return NextResponse.json(
      { error: "Failed to load referrals" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
    };

    const result = await attachReferral({
      referredUserId: user.id,
      code: body.code,
    });

    if (!result.ok) {
      const messages: Record<string, string> = {
        missing_code: "Enter a referral code.",
        invalid_code: "That referral code is invalid or inactive.",
        self_referral: "You can’t use your own referral code.",
        already_attached: "A referral is already linked to your account.",
        user_not_found: "User not found.",
      };
      return NextResponse.json(
        { error: messages[result.reason] || "Could not apply code" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      code: result.code,
      message: `Referral ${result.code} linked. Complete ${REFERRAL_MIN_TRANSACTIONS} transactions to unlock your bonus.`,
    });
  } catch (error) {
    console.error("[referrals-post]", error);
    return NextResponse.json(
      { error: "Failed to apply referral code" },
      { status: 500 },
    );
  }
}
