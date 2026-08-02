import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSession,
  revokeAdminSession,
  writeAdminAudit,
} from "@/lib/admin-auth";
import { notifyAdminLogout } from "@/lib/notify/auth-events";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await getAdminSession();
    if (session) {
      await writeAdminAudit({
        adminId: session.admin.id,
        action: "admin.logout",
        entityType: "admin",
        entityId: session.admin.id,
      });
      try {
        await notifyAdminLogout(session.admin);
      } catch (notifyError) {
        console.error("[admin-logout-notify]", notifyError);
      }
    }
    await revokeAdminSession();

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error("[admin-logout]", error);
    return NextResponse.json({ error: "Failed to log out" }, { status: 500 });
  }
}
