import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Old standalone pages were merged into tabbed sections; keep bookmarks and
  // shared links working by redirecting the removed routes.
  async redirects() {
    return [
      { source: "/dashboard/leads", destination: "/dashboard/clients?tab=leads", permanent: true },
      { source: "/dashboard/intake", destination: "/dashboard/clients?tab=forms", permanent: true },
      { source: "/dashboard/taxes", destination: "/dashboard/cashflow?tab=expenses", permanent: true },
      { source: "/dashboard/automations", destination: "/dashboard/settings?tab=automations", permanent: true },
      { source: "/dashboard/invoices", destination: "/dashboard/projects?tab=invoices", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "1xcoder-1s-org",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
