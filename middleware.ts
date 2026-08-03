import { NextResponse } from "next/server";
import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/cookie";
import { applyCorsHeaders } from "@/lib/external/cors";
import { resolveExternalToInternal } from "@/lib/external/paths";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/continue(.*)",
  "/otp(.*)",
  "/forgot-password(.*)",
  "/splash(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/api/geo(.*)",
  // Mobile / external clients authenticate inside route handlers via Bearer JWT
  "/api/external(.*)",
]);

const isExternalApi = createRouteMatcher(["/api/external(.*)"]);

// Don't auto-bounce /register or /otp — users may finish email OTP
// after a session cookie appears mid-flow.
const isAuthScreen = createRouteMatcher([
  "/login(.*)",
  "/forgot-password(.*)",
  "/splash(.*)",
]);

const isAppRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/wallet(.*)",
  "/fund(.*)",
  "/withdraw(.*)",
  "/history(.*)",
  "/notifications(.*)",
  "/profile(.*)",
  "/settings(.*)",
  "/services(.*)",
  "/support(.*)",
  "/about(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLogin = createRouteMatcher(["/admin/login"]);
const isAdminApi = createRouteMatcher(["/api/admin(.*)"]);

export default clerkMiddleware(
  async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/uploadthing")) {
    return NextResponse.next();
  }

  // External mobile API — CORS + rewrite to first-party /api/* (keeps Bearer auth)
  if (isExternalApi(request)) {
    if (request.method === "OPTIONS") {
      const res = new NextResponse(null, { status: 204 });
      applyCorsHeaders(res.headers, request);
      return res;
    }

    // Catalog/health stays on its own route handler
    if (pathname === "/api/external/v1" || pathname === "/api/external/v1/") {
      const res = NextResponse.next();
      applyCorsHeaders(res.headers, request);
      return res;
    }

    const remainder = pathname.replace(/^\/api\/external\/v1/, "") || "/";
    const resolved = resolveExternalToInternal(remainder);

    if (!resolved.ok) {
      const res = NextResponse.json(
        { error: resolved.error },
        { status: resolved.status },
      );
      applyCorsHeaders(res.headers, request);
      return res;
    }

    const url = request.nextUrl.clone();
    url.pathname = `/api${resolved.internalPath}`;
    console.log(
      `[external-api] rewrite ${pathname} → ${url.pathname}${url.search}`,
    );

    const res = NextResponse.rewrite(url);
    applyCorsHeaders(res.headers, request);
    res.headers.set("X-Oryno-Api-Version", "1");
    res.headers.set("X-Oryno-Internal-Path", resolved.internalPath);
    return res;
  }

  // Admin APIs authenticate themselves (Clerk + session)
  if (isAdminApi(request)) {
    return NextResponse.next();
  }

  // Admin UI requires Clerk + passcode session cookie
  if (isAdminRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      const login = new URL("/login", request.url);
      login.searchParams.set(
        "redirect_url",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(login);
    }

    const hasAdminSession = Boolean(
      request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    );

    // Cookie presence only — full validation is server-side via /api/admin/auth/me
    if (!isAdminLogin(request) && !hasAdminSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return NextResponse.next();
  }

  if (isAppRoute(request)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/login", request.url).toString(),
    });
  } else if (!isPublicRoute(request)) {
    // Keep other non-public routes open for now (landing assets, etc.)
  }

  const { userId } = await auth();
  if (userId && isAuthScreen(request)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
},
  {
    // Allow Expo / native session tokens whose azp is the Clerk FAPI or app scheme
    authorizedParties: [
      "https://orynoafrica.com",
      "https://www.orynoafrica.com",
      "https://clerk.orynoafrica.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8081",
      "oryno://",
      "exp://",
    ],
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
