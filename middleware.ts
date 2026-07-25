import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";

/**
 * Clerk is available as a dependency, but auth screens are currently custom.
 * Running `clerkMiddleware` without CLERK_* env keys causes
 * MIDDLEWARE_INVOCATION_FAILED (500) on Vercel.
 *
 * Use this lightweight middleware until Clerk keys + ClerkProvider are wired.
 * When ready for Clerk, swap back to clerkMiddleware and set:
 * - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
 * - CLERK_SECRET_KEY
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Keep UploadThing API open
  if (pathname.startsWith("/api/uploadthing")) {
    return NextResponse.next();
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
