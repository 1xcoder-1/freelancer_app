import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://freelance-book.app";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/features", "/architecture", "/ai", "/pricing", "/about", "/sign-in", "/sign-up"],
      disallow: ["/api/", "/dashboard/", "/_next/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
