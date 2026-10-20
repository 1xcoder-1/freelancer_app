// Route configuration used by the Next.js proxy (middleware) in src/proxy.ts.
// Keep this list in sync with the public-facing pages under src/app.

/** Routes that do NOT require authentication (Clerk protection skipped). */
export const publicRoutes = [
  "/",
  "/features(.*)",
  "/download",
  "/contact",
  "/privacy",
  "/terms",
  "/docs(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/portal(.*)",
  "/sign-contract(.*)",
  "/intake(.*)",
  "/booking(.*)",
  "/p(.*)",
  "/u(.*)",
  "/api(.*)",
];
