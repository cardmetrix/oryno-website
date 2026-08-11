import { CRISP_WEBSITE_ID } from "@/lib/support/config";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

export function isCrispConfigured() {
  return Boolean(CRISP_WEBSITE_ID);
}

export function crispEmbedUrl() {
  if (!CRISP_WEBSITE_ID) return null;
  return `https://go.crisp.chat/chat/embed/?website_id=${encodeURIComponent(CRISP_WEBSITE_ID)}`;
}

export function bootCrisp(user?: {
  email?: string | null;
  nickname?: string | null;
  userId?: string | null;
}) {
  if (typeof window === "undefined" || !CRISP_WEBSITE_ID) return;
  window.$crisp = window.$crisp || [];
  window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

  if (!document.querySelector("script[data-oryno-crisp]")) {
    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    script.dataset.orynoCrisp = "true";
    document.head.appendChild(script);
  }

  const crisp = window.$crisp;
  if (!crisp) return;
  crisp.push(["safe", true]);
  if (user?.email) crisp.push(["set", "user:email", [user.email]]);
  if (user?.nickname) crisp.push(["set", "user:nickname", [user.nickname]]);
  if (user?.userId) {
    crisp.push(["set", "session:data", [[["user_id", user.userId]]]]);
  }
}

export function openCrispChat() {
  if (typeof window === "undefined" || !window.$crisp) return false;
  window.$crisp.push(["do", "chat:show"]);
  window.$crisp.push(["do", "chat:open"]);
  return true;
}
