import { NextResponse } from "next/server";
import {
  canBootstrapAdmin,
  getAdminSession,
  resolveAdminForClerk,
} from "@/lib/admin/auth";
import { isDbConnectivityError, resetDbClient } from "@/lib/db";

export const runtime = "nodejs";

async function loadMe() {
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
}

export async function GET() {
  try {
    return await loadMe();
  } catch (error) {
    if (isDbConnectivityError(error)) {
      console.warn("[admin-me] db connectivity error — resetting pool and retrying once");
      await resetDbClient(error);
      try {
        return await loadMe();
      } catch (retryError) {
        console.error("[admin-me] retry failed", retryError);
        return NextResponse.json(
          {
            error: "Database temporarily unreachable. Retry in a moment.",
            code: "db_unavailable",
          },
          { status: 503 },
        );
      }
    }

    console.error("[admin-me]", error);
    return NextResponse.json(
      { error: "Failed to load admin session" },
      { status: 500 },
    );
  }
}
