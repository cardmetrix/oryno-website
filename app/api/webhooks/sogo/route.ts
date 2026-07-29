import { NextResponse } from "next/server";
import { handleSogoWebhookEvent } from "@/lib/sogo/sell";
import type { SogoWebhookEvent } from "@/lib/sogo/types";
import { verifySogoWebhookSignature } from "@/lib/sogo/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-sogo-signature-256");

    if (!verifySogoWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as SogoWebhookEvent;
    if (!body?.event) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (body.event === "ping") {
      return NextResponse.json({ ok: true, pong: true });
    }

    const result = await handleSogoWebhookEvent(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[sogo-webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
