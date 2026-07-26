import { NextResponse } from "next/server";
import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

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
  "/admin(.*)",
]);

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

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/uploadthing")) {
    return NextResponse.next();
  }

  // Admin uses a separate passcode cookie (not Clerk)
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";
  const hasAdminSession =
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value === "1";

  if (isAdminRoute && !isAdminLogin && !hasAdminSession) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (isAdminLogin && hasAdminSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isAdminRoute) {
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
