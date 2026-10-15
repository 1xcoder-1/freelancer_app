import type { Metadata } from "next";
import { cache } from "react";
import { getPublicLinkPage, type PublicLinkPage } from "@/lib/api";
import { PublicLinkPageView } from "@/components/link-page/PublicLinkPageView";

/* Dynamic: a published tree must reflect edits immediately and every open
   must count its view — no caching of the payload. */
export const dynamic = "force-dynamic";

// cache() dedupes the fetch between generateMetadata and the page itself.
const fetchPage = cache(async (slug: string): Promise<PublicLinkPage | null> => {
  try {
    return await getPublicLinkPage(slug);
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPage(slug);
  if (!page) return { title: "Link page not found — Freelance Book" };
  return {
    title: `${page.display_name} — Links`,
    description:
      page.bio ||
      page.headline ||
      `All of ${page.display_name}'s links in one place.`,
  };
}

export default async function PublicLinkPageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await fetchPage(slug);

  if (!page) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-8">
        <div className="text-center max-w-sm space-y-2">
          <div className="text-4xl">🔗</div>
          <h1 className="font-display text-xl font-medium text-fg">
            This page doesn&apos;t exist
          </h1>
          <p className="text-sm text-muted">
            The link page you tried to open was removed or hasn&apos;t been
            published yet.
          </p>
        </div>
      </div>
    );
  }

  return <PublicLinkPageView page={page} />;
}
