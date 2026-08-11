import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportMessages, supportTickets } from "@/lib/db/schema";
import { sendDirectBrandedEmail } from "@/lib/email/notify-email";
import { supportInbox } from "@/lib/email/client";
import { createNotification } from "@/lib/notifications-service";

function makeReference() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `ORY-${n}`;
}

export type SupportTicketDto = {
  id: string;
  reference: string;
  topic: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userName?: string | null;
};

export function toTicketDto(
  row: typeof supportTickets.$inferSelect,
  extra?: { userName?: string | null },
): SupportTicketDto {
  return {
    id: row.id,
    reference: row.reference,
    topic: row.topic,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userName: extra?.userName ?? null,
  };
}

export async function createSupportTicket(input: {
  userId: string;
  fullName: string;
  email: string;
  topic: string;
  message: string;
}) {
  const email = input.email.trim().toLowerCase();
  const topic = input.topic.trim() || "Other";
  const message = input.message.trim();
  if (!email || !message) {
    throw new Error("Email and message are required.");
  }

  let reference = makeReference();
  for (let i = 0; i < 5; i += 1) {
    const clash = await db.query.supportTickets.findFirst({
      where: eq(supportTickets.reference, reference),
      columns: { id: true },
    });
    if (!clash) break;
    reference = makeReference();
  }

  const subject = `${topic} — ${message.slice(0, 72)}`;
  const [ticket] = await db
    .insert(supportTickets)
    .values({
      reference,
      userId: input.userId,
      topic,
      email,
      subject,
      message,
      status: "open",
    })
    .returning();

  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    sender: "user",
    senderUserId: input.userId,
    body: message,
  });

  try {
    await createNotification({
      userId: input.userId,
      title: "Support ticket opened",
      body: `We’ve received ${reference}. Our team will reply by email and in Live Chat.`,
      type: "system",
      metadata: { href: "/support", kind: "ticket_opened", reference },
      forceEmail: true,
    });
  } catch (error) {
    console.error("[support-ticket-notify-user]", error);
  }

  try {
    await sendDirectBrandedEmail({
      to: supportInbox(),
      title: `New ticket ${reference}`,
      subject: `[ORYNO Support] ${reference} · ${topic}`,
      body: `New ticket from ${input.fullName} <${email}>.\n\nTopic: ${topic}\n\n${message}`,
      href: "/admin/support",
      ctaLabel: "Open tickets",
    });
  } catch (error) {
    console.error("[support-ticket-notify-inbox]", error);
  }

  return ticket;
}

export async function listUserTickets(userId: string) {
  return db.query.supportTickets.findMany({
    where: eq(supportTickets.userId, userId),
    orderBy: [desc(supportTickets.createdAt)],
    limit: 40,
  });
}

export async function replyToTicket(input: {
  ticketId: string;
  adminId?: string;
  body: string;
  status?: "open" | "in_progress" | "resolved" | "closed";
}) {
  const ticket = await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, input.ticketId),
  });
  if (!ticket) throw new Error("Ticket not found");

  const body = input.body.trim();
  if (body) {
    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      sender: "agent",
      senderAdminId: input.adminId ?? null,
      body,
    });
  }

  const status = input.status ?? "in_progress";
  const [updated] = await db
    .update(supportTickets)
    .set({ status, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id))
    .returning();

  if (ticket.userId && body) {
    try {
      await createNotification({
        userId: ticket.userId,
        title: `Support update · ${ticket.reference}`,
        body,
        type: "system",
        metadata: {
          href: "/support",
          kind: "ticket_reply",
          reference: ticket.reference,
        },
        forceEmail: true,
      });
    } catch (error) {
      console.error("[support-ticket-reply-notify]", error);
    }
  }

  return updated;
}
