import {
    ADMIN_SESSION_COOKIE,
    adminCookieOptions,
    canBootstrapAdmin,
    createAdminSession,
    ensureBootstrapAdmin,
    isValidAdminPasscode,
    resolveAdminForClerk,
} from "@/lib/admin/auth";
import { notifyAdminLogin } from "@/lib/notify/auth-events";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      passcode?: string;
    };
    const passcode = String(body.passcode || "");

    const { clerk, admin: existing, reason } = await resolveAdminForClerk();

    if (reason === "not_signed_in" || !clerk.email) {
      return NextResponse.json(
        { error: "Sign in with your ORYNO account first" },
        { status: 401 },
      );
    }

    if (reason === "inactive") {
      return NextResponse.json(
        { error: "This admin account is disabled" },
        { status: 403 },
      );
    }

    const mayBootstrap =
      !existing && (await canBootstrapAdmin(clerk.email));

    if (!existing && !mayBootstrap) {
      return NextResponse.json(
        {
          error:
            "Your account is not an admin. Ask a super admin to add your email to the admins list.",
        },
        { status: 403 },
      );
    }

    if (!process.env.ADMIN_PASSCODE?.trim()) {
      return NextResponse.json(
        { error: "ADMIN_PASSCODE is not configured on the server" },
        { status: 500 },
      );
    }

    if (!isValidAdminPasscode(passcode)) {
      return NextResponse.json(
        { error: "Incorrect passcode. Try again." },
        { status: 401 },
      );
    }

    let admin = existing;
    if (!admin && mayBootstrap) {
      admin = await ensureBootstrapAdmin({
        email: clerk.email,
        name: clerk.name,
      });
    }

    if (!admin) {
      return NextResponse.json(
        { error: "Unable to create admin account" },
        { status: 500 },
      );
    }

    const session = await createAdminSession(admin);

    try {
      await notifyAdminLogin(admin);
    } catch (notifyError) {
      console.error("[admin-login-notify]", notifyError);
    }

    const res = NextResponse.json({
      ok: true,
      // Returned for mobile / native clients that cannot use HttpOnly cookies.
      sessionToken: session.token,
      expiresAt: session.expiresAt.toISOString(),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });

    res.cookies.set(
      ADMIN_SESSION_COOKIE,
      session.token,
      adminCookieOptions(session.maxAgeSec),
    );

    return res;
  } catch (error) {
    console.error("[admin-login]", error);
    return NextResponse.json(
      { error: "Failed to unlock admin" },
      { status: 500 },
    );
  }
}
