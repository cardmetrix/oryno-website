import { NextResponse } from "next/server";
import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/cookie";
import { applyCorsHeaders } from "@/lib/external/cors";
import {
  resolveApiServicesRewrite,
  resolveExternalToInternal,
} from "@/lib/external/paths";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  "/continue(.*)",
  "/otp(.*)",
  "/verify-2fa(.*)",
  "/forgot-password(.*)",
  "/splash(.*)",
  "/sso-callback(.*)",
  "/terms(.*)",
  "/privacy(.*)",
  "/api/webhooks(.*)",
  "/api/geo(.*)",
  // Mobile / external clients authenticate inside route handlers via Bearer JWT
  "/api/external(.*)",
  // First-party APIs also authenticate in handlers (Expo may call /api/* directly)
  "/api/auth(.*)",
  "/api/wallet(.*)",
  "/api/transactions(.*)",
  "/api/notifications(.*)",
  "/api/devices(.*)",
  "/api/ads(.*)",
  "/api/onboarding(.*)",
  "/api/testimonials(.*)",
  "/api/landing-assets(.*)",
  "/api/profile(.*)",
  "/api/settings(.*)",
  "/api/me(.*)",
  "/api/support(.*)",
  "/api/services(.*)",
  "/api/vtpass(.*)",
  "/api/herosms(.*)",
  "/api/jap(.*)",
  "/api/reloadly(.*)",
  "/api/sogo(.*)",
  "/api/betting(.*)",
  "/api/invoices(.*)",
  "/api/pay(.*)",
  "/api/mobile-health(.*)",
  "/pay(.*)",
]);

const isExternalApi = createRouteMatcher(["/api/external(.*)"]);

const isAuthScreen = createRouteMatcher([
  "/login(.*)",
  "/register(.*)",
  "/forgot-password(.*)",
  "/splash(.*)",
]);

const isAppRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/cards(.*)",
  "/fund(.*)",
  "/convert(.*)",
  "/withdraw(.*)",
  "/history(.*)",
  "/notifications(.*)",
  "/profile(.*)",
  "/settings(.*)",
  "/services(.*)",
  "/support(.*)",
  "/about(.*)",
  "/invoices(.*)",
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

  // Friendly /api/services/* aliases (when route files are missing / stale)
  if (
    pathname.startsWith("/api/services/") &&
    pathname !== "/api/services/"
  ) {
    const resolved = resolveApiServicesRewrite(pathname);
    if (resolved.ok) {
      const url = request.nextUrl.clone();
      url.pathname = `/api${resolved.internalPath}`;
      console.log(
        `[services-api] rewrite ${pathname} → ${url.pathname}${url.search}`,
      );
      return NextResponse.rewrite(url);
    }
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
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
