import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { mapClerkWebhookUser } from "@/lib/auth/map-clerk-webhook";
import {
  softDeleteClerkUser,
  syncClerkUserToDb,
} from "@/lib/auth/sync-user";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        await syncClerkUserToDb(mapClerkWebhookUser(evt.data));
        break;
      }
      case "user.deleted": {
        if (evt.data.id) {
          await softDeleteClerkUser(evt.data.id);
        }
        break;
      }
      default:
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("[clerk-webhook]", error);
    return new Response("Webhook verification failed", { status: 400 });
  }
}
