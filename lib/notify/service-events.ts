import { createNotification } from "@/lib/notifications-service";

/** In-app + email + push. Failures are logged, never thrown to the purchase flow. */
export async function notifyServiceEvent(input: {
  userId: string;
  title: string;
  body: string;
  type: string;
  href: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await createNotification({
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      metadata: {
        href: input.href,
        ...(input.metadata ?? {}),
      },
    });
  } catch (error) {
    console.error("[service-notify]", error);
  }
}
