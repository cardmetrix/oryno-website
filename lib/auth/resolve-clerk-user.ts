import {
  auth,
  clerkClient,
  createClerkClient,
  currentUser,
  verifyToken,
  type User,
} from "@clerk/nextjs/server";
import { headers } from "next/headers";

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
  exp?: number;
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
      exp?: number;
    };
  } catch {
    return null;
  }
}

/**
 * Clerk's verifyToken is wrapped with withLegacyReturn:
 * - success → JwtPayload directly ({ sub, ... })
 * - failure → throws
 * Some code paths also return { data, errors }. Support both.
 */
function extractUserIdFromVerifyResult(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;

  if (typeof r.sub === "string" && r.sub.startsWith("user_")) return r.sub;

  if (r.data && typeof r.data === "object") {
    const sub = (r.data as { sub?: unknown }).sub;
    if (typeof sub === "string" && sub.startsWith("user_")) return sub;
  }

  return null;
}

export type ResolveClerkDebug = {
  hasBearer: boolean;
  peeked?: { sub?: string; sid?: string; azp?: string; iss?: string };
  steps: Record<string, string>;
};

/**
 * Resolves Clerk user for web cookies and Expo Bearer session JWTs.
 */
export async function resolveClerkUser(request?: Request): Promise<{
  user: User | null;
  debug: ResolveClerkDebug;
}> {
  const debug: ResolveClerkDebug = { hasBearer: false, steps: {} };

  // 1) Web / middleware-hydrated session
  try {
    const fromHelper = await currentUser();
    if (fromHelper) {
      debug.steps.currentUser = "ok";
      return { user: fromHelper, debug };
    }
    debug.steps.currentUser = "null";
  } catch (error) {
    debug.steps.currentUser =
      error instanceof Error ? `error:${error.message}` : "error";
    console.error("[resolveClerkUser] currentUser", error);
  }

  // 2) auth() may already have userId
  try {
    const session = await auth({ acceptsToken: "any" });
    if (session.userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(session.userId);
      debug.steps.auth = "ok";
      return { user, debug };
    }
    debug.steps.auth = "null";
  } catch (error) {
    debug.steps.auth =
      error instanceof Error ? `error:${error.message}` : "error";
    console.error("[resolveClerkUser] auth+getUser", error);
  }

  // 3) Explicit Bearer JWT (Expo)
  try {
    const h = request ? request.headers : await headers();
    const token = bearerFromAuthorization(h.get("authorization"));
    debug.hasBearer = Boolean(token);
    if (!token) {
      debug.steps.bearer = "missing";
      return { user: null, debug };
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      debug.steps.bearer = "missing_secret_key";
      console.error("[resolveClerkUser] CLERK_SECRET_KEY missing");
      return { user: null, debug };
    }

    const peeked = decodeJwtPayload(token);
    debug.peeked = {
      sub: peeked?.sub,
      sid: peeked?.sid,
      azp: peeked?.azp,
      iss: peeked?.iss,
    };
    console.log("[resolveClerkUser] bearer peek", debug.peeked);

    const client = createClerkClient({
      secretKey,
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });

    let userId: string | null = null;

    // 3a) Fast path for Expo: active Backend session matching JWT claims
    // (works even when verifyToken/azp quirks reject native tokens)
    if (peeked?.sub && peeked?.sid) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const notExpired =
          typeof peeked.exp !== "number" || peeked.exp + 60 >= now;
        const session = await client.sessions.getSession(peeked.sid);
        if (
          notExpired &&
          session.status === "active" &&
          session.userId === peeked.sub
        ) {
          userId = peeked.sub;
          debug.steps.getSession = `ok:${userId}`;
          console.log("[resolveClerkUser] getSession ok", { sub: userId });
        } else {
          debug.steps.getSession = `mismatch:status=${session.status},userId=${session.userId},expired=${!notExpired}`;
        }
      } catch (getSessionError) {
        debug.steps.getSession =
          getSessionError instanceof Error
            ? `throw:${getSessionError.message}`
            : "throw";
        console.warn("[resolveClerkUser] getSession failed", getSessionError);
      }
    }

    // 3b) verifyToken (legacy wrapper returns payload OR throws)
    if (!userId) {
      try {
        const options: {
          secretKey: string;
          clockSkewInMs: number;
          jwtKey?: string;
        } = {
          secretKey,
          clockSkewInMs: 60_000,
        };
        if (process.env.CLERK_JWT_KEY?.trim()) {
          options.jwtKey = process.env.CLERK_JWT_KEY;
        }

        const verified = await verifyToken(token, options);
        userId = extractUserIdFromVerifyResult(verified);
        debug.steps.verifyToken = userId
          ? `ok:${userId}`
          : `no_sub:${JSON.stringify(verified)?.slice(0, 120)}`;
        if (userId) {
          console.log("[resolveClerkUser] verifyToken ok", { sub: userId });
        }
      } catch (verifyError) {
        debug.steps.verifyToken =
          verifyError instanceof Error
            ? `throw:${verifyError.message}`
            : "throw";
        console.warn("[resolveClerkUser] verifyToken threw", verifyError);
      }
    }

    // 3b) sessions.verifySession(sid, token)
    if (!userId && peeked?.sid) {
      try {
        const session = await client.sessions.verifySession(peeked.sid, token);
        userId = session.userId || peeked.sub || null;
        debug.steps.verifySession = userId
          ? `ok:${userId}:${session.status}`
          : `empty:${session.status}`;
        console.log("[resolveClerkUser] verifySession ok", {
          sub: userId,
          status: session.status,
        });
      } catch (sessionError) {
        debug.steps.verifySession =
          sessionError instanceof Error
            ? `throw:${sessionError.message}`
            : "throw";
        console.warn("[resolveClerkUser] verifySession failed", sessionError);
      }
    } else if (!userId) {
      debug.steps.verifySession = "skipped_no_sid";
    }

    // 3c) authenticateRequest — omit authorizedParties when azp is absent
    if (!userId) {
      try {
        const host =
          h.get("x-forwarded-host") || h.get("host") || "orynoafrica.com";
        const proto = h.get("x-forwarded-proto") || "https";
        const url = request?.url || `${proto}://${host}/api/auth/sync`;

        const authOptions: {
          secretKey: string;
          acceptsToken: "any";
          jwtKey?: string;
        } = {
          secretKey,
          acceptsToken: "any",
        };
        if (process.env.CLERK_JWT_KEY?.trim()) {
          authOptions.jwtKey = process.env.CLERK_JWT_KEY;
        }

        const requestState = await client.authenticateRequest(
          request ??
            new Request(url, {
              method: "POST",
              headers: {
                authorization: `Bearer ${token}`,
                cookie: h.get("cookie") || "",
                origin: h.get("origin") || "https://orynoafrica.com",
                "user-agent": h.get("user-agent") || "oryno-africa",
                accept: "application/json",
              },
            }),
          authOptions,
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
          debug.steps.authenticateRequest = userId
            ? `ok:${userId}`
            : "authenticated_no_user";
        } else {
          debug.steps.authenticateRequest = `rejected:${
            (requestState as { reason?: string }).reason ||
            (requestState as { status?: string }).status ||
            "unknown"
          }`;
        }
      } catch (authReqError) {
        debug.steps.authenticateRequest =
          authReqError instanceof Error
            ? `throw:${authReqError.message}`
            : "throw";
        console.warn(
          "[resolveClerkUser] authenticateRequest error",
          authReqError,
        );
      }
    }

    if (!userId) {
      debug.steps.result = "all_failed";
      console.warn("[resolveClerkUser] all bearer strategies failed", debug);
      return { user: null, debug };
    }

    const user = await client.users.getUser(userId);
    debug.steps.result = `ok:${userId}`;
    return { user, debug };
  } catch (error) {
    debug.steps.bearer =
      error instanceof Error ? `fatal:${error.message}` : "fatal";
    console.error("[resolveClerkUser] bearer", error);
    return { user: null, debug };
  }
}
