import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { notifyUserLogout } from "@/lib/notify/auth-events";

export const runtime = "nodejs";

/** Called before Clerk signOut so we can record logout + email. */
export async function POST() {
  try {
    const user = await ensureAppUser();
    if (user) {
      try {
        await notifyUserLogout(user);
      } catch (error) {
        console.error("[auth-logout-notify]", error);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth-logout]", error);
    return NextResponse.json({ ok: true });
  }
}
