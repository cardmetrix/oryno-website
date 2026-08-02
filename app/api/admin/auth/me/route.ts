import { NextResponse } from "next/server";
import {
  canBootstrapAdmin,
  getAdminSession,
  resolveAdminForClerk,
} from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { clerk, admin, reason } = await resolveAdminForClerk();

    if (reason === "not_signed_in" || !clerk.email) {
      return NextResponse.json(
        { ok: false, signedIn: false, isAdmin: false, session: false },
        { status: 401 },
      );
    }

    if (!admin) {
      const bootstrap = await canBootstrapAdmin(clerk.email);
      return NextResponse.json(
        {
          ok: false,
          signedIn: true,
          isAdmin: false,
          canBootstrap: bootstrap,
          session: false,
          email: clerk.email,
          reason: reason === "inactive" ? "inactive" : "not_admin",
        },
        { status: bootstrap ? 200 : 403 },
      );
    }

    const session = await getAdminSession();

    // Stale cookie (wrong user / expired) — tell clients to clear via logout
    return NextResponse.json({
      ok: Boolean(session),
      signedIn: true,
      isAdmin: true,
      session: Boolean(session),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      clerk: {
        email: clerk.email,
        name: clerk.name,
      },
    });
  } catch (error) {
    console.error("[admin-me]", error);
    return NextResponse.json(
      { error: "Failed to load admin session" },
      { status: 500 },
    );
  }
}
