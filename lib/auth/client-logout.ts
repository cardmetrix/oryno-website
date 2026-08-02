import { clearLoginAnnounced } from "@/lib/auth/client-sync";

/** Notify server of logout (email + in-app), then let Clerk finish sign-out. */
export async function announceLogout() {
  clearLoginAnnounced();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // never block sign-out
  }
}
