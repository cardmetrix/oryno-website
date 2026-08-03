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

/** Decode JWT payload without verifying (sid/sub peek only). */
function decodeJwtPayload(token: string): {
  sub?: string;
  sid?: string;
  azp?: string;
  iss?: string;
} | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(
      part.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json) as {
      sub?: string;
      sid?: string;
      azp?: string;
      iss?: string;
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the Clerk user for:
 * - Web (session cookies)
 * - Mobile Expo (Authorization: Bearer <session JWT>)
 */
export async function resolveClerkUser(request?: Request): Promise<User | null> {
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
    const h = request ? request.headers : await headers();
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

    const peeked = decodeJwtPayload(token);
    console.log("[resolveClerkUser] bearer peek", {
      sub: peeked?.sub,
      sid: peeked?.sid,
      azp: peeked?.azp,
      iss: peeked?.iss,
    });

    const client = await clerkClient();
    let userId: string | null = null;

    // 3a) verifyToken — returns { data, errors }, does NOT throw on failure
    const verified = await verifyToken(token, {
      secretKey,
      jwtKey: process.env.CLERK_JWT_KEY,
    });

    if (verified.data?.sub) {
      userId = verified.data.sub;
      console.log("[resolveClerkUser] verifyToken ok", {
        sub: userId,
        azp: (verified.data as { azp?: string }).azp,
        iss: (verified.data as { iss?: string }).iss,
      });
    } else {
      console.warn("[resolveClerkUser] verifyToken failed", {
        errors: verified.errors?.map((e) => e.message ?? String(e)),
      });
    }

    // 3b) Classic mobile path: sessions.verifySession(sid, token)
    if (!userId && peeked?.sid) {
      try {
        const session = await client.sessions.verifySession(peeked.sid, token);
        userId = session.userId || peeked.sub || null;
        console.log("[resolveClerkUser] verifySession ok", {
          sub: userId,
          status: session.status,
        });
      } catch (sessionError) {
        console.warn("[resolveClerkUser] verifySession failed", {
          message:
            sessionError instanceof Error
              ? sessionError.message
              : String(sessionError),
        });
      }
    }

    // 3c) authenticateRequest with the real Request when available
    if (!userId) {
      try {
        const host =
          h.get("x-forwarded-host") || h.get("host") || "orynoafrica.com";
        const proto = h.get("x-forwarded-proto") || "https";
        const url = request?.url || `${proto}://${host}/`;

        const requestState = await client.authenticateRequest(
          request ??
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

        if (authenticated) {
          userId = requestState.toAuth()?.userId ?? null;
          console.log("[resolveClerkUser] authenticateRequest ok", { sub: userId });
        } else {
          console.warn("[resolveClerkUser] authenticateRequest rejected", {
            status: (requestState as { status?: string }).status,
            reason: (requestState as { reason?: string }).reason,
            message: (requestState as { message?: string }).message,
          });
        }
      } catch (authReqError) {
        console.warn("[resolveClerkUser] authenticateRequest error", authReqError);
      }
    }

    // Last resort: if token peeks a user id and session is active via Backend API
    if (!userId && peeked?.sub && peeked?.sid) {
      try {
        const session = await client.sessions.getSession(peeked.sid);
        if (session.status === "active" && session.userId === peeked.sub) {
          userId = peeked.sub;
          console.warn(
            "[resolveClerkUser] accepting active session via getSession fallback",
            { sub: userId },
          );
        }
      } catch (getSessionError) {
        console.warn("[resolveClerkUser] getSession fallback failed", getSessionError);
      }
    }

    if (!userId) {
      console.warn("[resolveClerkUser] all bearer strategies failed");
      return null;
    }

    return await client.users.getUser(userId);
  } catch (error) {
    console.error("[resolveClerkUser] bearer", error);
    return null;
  }
}
