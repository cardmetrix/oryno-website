import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { titleCaseStatus, withAdminApi } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { supportTickets, users } from "@/lib/db/schema";
import { replyToTicket, toTicketDto } from "@/lib/support/tickets";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "").trim();

    const rows = await db
      .select({
        ticket: supportTickets,
        userName: users.fullName,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .where(status ? eq(supportTickets.status, status as never) : undefined)
      .orderBy(desc(supportTickets.createdAt))
      .limit(200);

    return NextResponse.json({
      tickets: rows.map((row) => ({
        ...toTicketDto(row.ticket, { userName: row.userName }),
        statusLabel: titleCaseStatus(row.ticket.status),
      })),
    });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const body = (await req.json()) as {
      ticketId?: string;
      status?: "open" | "in_progress" | "resolved" | "closed";
      reply?: string;
    };
    if (!body.ticketId) {
      return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
    }
    const updated = await replyToTicket({
      ticketId: body.ticketId,
      adminId: admin.id,
      body: body.reply || "",
      status: body.status,
    });
    return NextResponse.json({
      ok: true,
      ticket: toTicketDto(updated),
    });
  });
}
