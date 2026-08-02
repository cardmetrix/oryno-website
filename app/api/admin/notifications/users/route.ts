import { NextResponse } from "next/server";
import { searchCampaignUsers } from "@/lib/admin/campaigns";
import { withAdminApi } from "@/lib/admin/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const users = await searchCampaignUsers(q, 40);
    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        status: u.status,
        country: u.countryCode || "—",
      })),
    });
  });
}
