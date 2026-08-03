import {
  auth,
  clerkClient,
  currentUser,
  verifyToken,
  type User,
} from "@clerk/nextjs/server";
import { headers } from "next/headers";

const AUTHORIZED_PARTIES = [
  "https://orynoafrica.com",
  "https://www.orynoafrica.com",
  "https://clerk.orynoafrica.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8081",
  "oryno://",
  "exp://",
];

function bearerFromAuthorization(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Resolves the Clerk user for:
 * - Web (session cookies)
 * - Mobile Expo (Authorization: Bearer <session JWT>)
 *
 * Native tokens often fail cookie-only helpers and azp checks — verify the JWT
 * with the secret key first, then load the user from the Backend API.
 */
export async function resolveClerkUser(): Promise<User | null> {
  // 1) Web / middleware-hydrated session
  try {
    const fromHelper = await currentUser();
    if (fromHelper) return fromHelper;
  } catch (error) {
    console.error("[resolveClerkUser] currentUser", error);
  }

  // 2) auth() may already have userId (cookie or accepted Bearer)
  try {
    const session = await auth({ acceptsToken: "any" });
    if (session.userId) {
      const client = await clerkClient();
      return await client.users.getUser(session.userId);
    }
  } catch (error) {
    console.error("[resolveClerkUser] auth+getUser", error);
  }

  // 3) Explicit Bearer JWT verification (Expo / cross-origin)
  try {
    const h = await headers();
    const token = bearerFromAuthorization(h.get("authorization"));
    if (!token) {
      console.warn("[resolveClerkUser] no clerk session and no Bearer token");
      return null;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.error("[resolveClerkUser] CLERK_SECRET_KEY missing");
      return null;
    }

    // Prefer signature verification without azp lock — Expo azp varies by client.
    let userId: string | null = null;
    try {
      const payload = await verifyToken(token, { secretKey });
      userId = typeof payload.sub === "string" ? payload.sub : null;
      console.log("[resolveClerkUser] verifyToken ok", {
        sub: userId,
        azp: (payload as { azp?: string }).azp,
        iss: (payload as { iss?: string }).iss,
      });
    } catch (verifyError) {
      console.warn("[resolveClerkUser] verifyToken failed, trying authenticateRequest", {
        message:
          verifyError instanceof Error ? verifyError.message : String(verifyError),
      });

      const host =
        h.get("x-forwarded-host") || h.get("host") || "orynoafrica.com";
      const proto = h.get("x-forwarded-proto") || "https";
      const url = `${proto}://${host}/`;

      const client = await clerkClient();
      const requestState = await client.authenticateRequest(
        new Request(url, {
          headers: {
            authorization: `Bearer ${token}`,
            cookie: h.get("cookie") || "",
            origin: h.get("origin") || "https://orynoafrica.com",
            "user-agent": h.get("user-agent") || "oryno-africa",
          },
        }),
        {
          secretKey,
          acceptsToken: "any",
          authorizedParties: AUTHORIZED_PARTIES,
        },
      );

      const authenticated =
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
          message: (requestState as { message?: string }).message,
        });
        return null;
      }

      userId = requestState.toAuth()?.userId ?? null;
    }

    if (!userId) {
      console.warn("[resolveClerkUser] token verified but no userId/sub");
      return null;
    }

    const client = await clerkClient();
    return await client.users.getUser(userId);
  } catch (error) {
    console.error("[resolveClerkUser] bearer", error);
    return null;
  }
}
