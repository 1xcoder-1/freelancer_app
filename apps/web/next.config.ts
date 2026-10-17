import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

const wrapped = withMDX(nextConfig);

// Sentry's bundler wrapper adds work to every dev compile (native debug ids for
// all chunks + per-route injection rules) and is what inflates .next/dev into
// multi-GB territory, while the maps it prepares are only ever uploaded by a
// build. The runtime SDK still reports in dev; only build-time work is skipped.
export default process.env.NODE_ENV === "development"
  ? wrapped
  : withSentryConfig(wrapped, {
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
    });