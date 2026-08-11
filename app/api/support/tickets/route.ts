import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import {
  createSupportTicket,
  listUserTickets,
  toTicketDto,
} from "@/lib/support/tickets";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await listUserTickets(user.id);
    return NextResponse.json({
      tickets: rows.map((row) => toTicketDto(row)),
    });
  } catch (error) {
    console.error("[support-tickets-get]", error);
    return NextResponse.json(
      { error: "Failed to load tickets" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json()) as {
      topic?: string;
      email?: string;
      message?: string;
    };
    const ticket = await createSupportTicket({
      userId: user.id,
      fullName: user.fullName,
      email: body.email || user.email,
      topic: body.topic || "Other",
      message: body.message || "",
    });
    return NextResponse.json({
      ok: true,
      ticket: toTicketDto(ticket),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ticket";
    console.error("[support-tickets-post]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
