import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { sendSupportErrorReport } from "@/lib/email/support";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      errorMessage?: string;
      page?: string;
      userNote?: string;
      url?: string;
    };

    const errorMessage = body.errorMessage?.trim();
    if (!errorMessage) {
      return NextResponse.json(
        { error: "Error message is required" },
        { status: 400 },
      );
    }

    const result = await sendSupportErrorReport({
      errorMessage,
      page: body.page?.trim() || null,
      userNote: body.userNote?.trim() || null,
      userEmail: user.email,
      userName: user.fullName || null,
      userId: user.id,
      url: body.url?.trim() || null,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      message: `Report sent to ${result.to}. We'll get back to you soon.`,
    });
  } catch (error) {
    console.error("[support-error-report]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to contact support",
      },
      { status: 400 },
    );
  }
}
