import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { publicRoutes } from "@/config/public-routes";

// Next.js convention: this file MUST stay at src/proxy.ts (Next.js 16 replaces
// the deprecated `middleware.ts`). Route lists live in @/config/public-routes.
const isPublicRoute = createRouteMatcher(publicRoutes);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

// Next.js parses `config.matcher` at compile-time, so it MUST be a static
// literal written directly in this file — imported constants are not allowed.
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|ttf|woff2?|png|jpg|jpeg|gif|svg|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
