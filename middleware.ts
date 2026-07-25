import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/user(.*)',
  '/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Get the current URL
  const { userId } = await auth();
  const pathname = req.nextUrl.pathname;

  // Allow UploadThing API routes to pass through without authentication
  if (pathname.startsWith('/api/uploadthing')) {
    return NextResponse.next();
  }

  // If user is not signed in and trying to access a protected route
  if (!userId && isProtectedRoute(req)) {
    // Redirect to login page
    const loginUrl = new URL('/login', req.url);
    // Add the original URL as a redirect parameter
    loginUrl.searchParams.set('redirect', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is signed in and trying to access login/register, allow it
  // (The pages themselves will handle redirecting to dashboard)
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

