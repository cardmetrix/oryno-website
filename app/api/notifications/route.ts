import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  countUnread,
  deleteAllRead,
  deleteNotification,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  toNotificationDto,
} from "@/lib/notifications-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [rows, unreadCount] = await Promise.all([
      listUserNotifications(user.id, 80),
      countUnread(user.id),
    ]);

    return NextResponse.json(
      {
        items: rows.map(toNotificationDto),
        unreadCount,
        count: rows.length,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[notifications-get]", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      id?: string;
      markAll?: boolean;
    };

    if (body.markAll) {
      await markAllNotificationsRead(user.id);
    } else if (body.id) {
      const updated = await markNotificationRead(user.id, body.id);
      if (!updated) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const [rows, unreadCount] = await Promise.all([
      listUserNotifications(user.id, 80),
      countUnread(user.id),
    ]);

    return NextResponse.json({
      ok: true,
      items: rows.map(toNotificationDto),
      unreadCount,
      count: rows.length,
    });
  } catch (error) {
    console.error("[notifications-patch]", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clearRead = searchParams.get("clearRead") === "1";

    if (clearRead) {
      await deleteAllRead(user.id);
    } else if (id) {
      const removed = await deleteNotification(user.id, id);
      if (!removed) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const [rows, unreadCount] = await Promise.all([
      listUserNotifications(user.id, 80),
      countUnread(user.id),
    ]);

    return NextResponse.json({
      ok: true,
      items: rows.map(toNotificationDto),
      unreadCount,
      count: rows.length,
    });
  } catch (error) {
    console.error("[notifications-delete]", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 },
    );
  }
}
