import {
  auth,
  clerkClient,
  currentUser,
  type User,
} from "@clerk/nextjs/server";
import { headers } from "next/headers";

/**
 * Resolves the Clerk user for web (cookies) and mobile (Authorization: Bearer).
 * Mobile Expo sends a session JWT; cookie-only helpers often return null for that.
 */
export async function resolveClerkUser(): Promise<User | null> {
  // 1) Prefer middleware/cookie session (web + when Bearer was already accepted)
  try {
    const fromHelper = await currentUser();
    if (fromHelper) return fromHelper;
  } catch (error) {
    console.error("[resolveClerkUser] currentUser", error);
  }

  // 2) auth() may have userId even when currentUser() failed (rate limit / transient)
  try {
    const { userId } = await auth();
    if (userId) {
      const client = await clerkClient();
      return await client.users.getUser(userId);
    }
  } catch (error) {
    console.error("[resolveClerkUser] auth+getUser", error);
  }

  // 3) Explicit Bearer verification for native clients
  try {
    const h = await headers();
    const authorization = h.get("authorization");
    if (!authorization || !/^bearer\s+/i.test(authorization)) {
      return null;
    }

    const host =
      h.get("x-forwarded-host") ||
      h.get("host") ||
      "orynoafrica.com";
    const proto = h.get("x-forwarded-proto") || "https";
    const url = `${proto}://${host}/`;

    const client = await clerkClient();
    const requestState = await client.authenticateRequest(
      new Request(url, {
        headers: {
          authorization,
          cookie: h.get("cookie") || "",
        },
      }),
    );

    const authenticated =
      // Clerk Backend SDK variants
      ("isAuthenticated" in requestState &&
        Boolean(
          (requestState as { isAuthenticated?: boolean }).isAuthenticated,
        )) ||
      ("isSignedIn" in requestState &&
        Boolean((requestState as { isSignedIn?: boolean }).isSignedIn));

    if (!authenticated) {
      console.warn("[resolveClerkUser] bearer rejected", {
        status: (requestState as { status?: string }).status,
        reason: (requestState as { reason?: string }).reason,
      });
      return null;
    }

    const authState = requestState.toAuth();
    const userId = authState?.userId;
    if (!userId) {
      console.warn("[resolveClerkUser] bearer ok but no userId");
      return null;
    }

    return await client.users.getUser(userId);
  } catch (error) {
    console.error("[resolveClerkUser] bearer", error);
    return null;
  }
}
