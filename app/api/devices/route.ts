import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { APP_VERSION } from "@/lib/app-version";
import {
  isExpoPushToken,
  removePushToken,
  upsertPushToken,
} from "@/lib/push/tokens";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      token?: string;
      platform?: string;
      deviceId?: string;
      appVersion?: string;
    };

    const token = body.token?.trim();
    if (!token || !isExpoPushToken(token)) {
      return NextResponse.json(
        { error: "Valid Expo push token required" },
        { status: 400 },
      );
    }

    const row = await upsertPushToken({
      userId: user.id,
      token,
      platform: body.platform,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      token: row.token,
      appVersion: APP_VERSION,
      serverAppVersion: APP_VERSION,
    });
  } catch (error) {
    console.error("[devices-post]", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let token = searchParams.get("token")?.trim() || undefined;
    let deviceId = searchParams.get("deviceId")?.trim() || undefined;
    const clearAll =
      searchParams.get("all") === "1" || searchParams.get("all") === "true";

    if (clearAll) {
      await removePushToken({ userId: user.id });
      return NextResponse.json({ ok: true });
    }

    if (!token && !deviceId) {
      try {
        const body = (await req.json()) as {
          token?: string;
          deviceId?: string;
          all?: boolean;
        };
        token = body.token?.trim() || undefined;
        deviceId = body.deviceId?.trim() || undefined;
        if (body.all) {
          await removePushToken({ userId: user.id });
          return NextResponse.json({ ok: true });
        }
      } catch {
        // no body
      }
    }

    if (!token && !deviceId) {
      return NextResponse.json(
        { error: "token or deviceId required" },
        { status: 400 },
      );
    }

    await removePushToken({ userId: user.id, token, deviceId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[devices-delete]", error);
    return NextResponse.json(
      { error: "Failed to unregister device" },
      { status: 500 },
    );
  }
}
