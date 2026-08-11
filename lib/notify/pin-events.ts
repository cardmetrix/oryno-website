import { createNotification } from "@/lib/notifications-service";
import { APP_VERSION } from "@/lib/app-version";

function whenLabel() {
  return new Date().toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function notifyTransactionPinChanged(input: {
  userId: string;
  fullName: string;
  created: boolean;
}) {
  const first = input.fullName.split(" ")[0] || "there";
  const title = input.created
    ? "Transaction PIN created"
    : "Transaction PIN changed";
  const body = input.created
    ? `Hi ${first}, your ORYNO transaction PIN was set on ${whenLabel()}. You’ll need it for withdrawals. App ${APP_VERSION}.`
    : `Hi ${first}, your ORYNO transaction PIN was changed on ${whenLabel()}. If this wasn’t you, contact support immediately. App ${APP_VERSION}.`;

  await createNotification({
    userId: input.userId,
    title,
    body,
    type: "security",
    metadata: {
      href: "/settings/security",
      kind: input.created ? "pin_created" : "pin_changed",
      appVersion: APP_VERSION,
    },
    forceEmail: true,
    forcePush: true,
  });
}
