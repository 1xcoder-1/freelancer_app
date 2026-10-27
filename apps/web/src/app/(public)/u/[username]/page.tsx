import type { Metadata } from "next";
import { cache } from "react";
import { getPublicReportCard } from "@/lib/api";
import { PublicReportCardView } from "@/components/report-card/PublicReportCardScreen";
import { CardNotice } from "@/components/report-card/States";

/* Dynamic: revoking a share link or editing the card must be visible on the
   very next open — the payload is never cached. */
export const dynamic = "force-dynamic";

type FetchError = "revoked" | "expired" | "notfound";

// cache() dedupes the fetch between generateMetadata and the page itself.
const fetchCard = cache(
  async (
    username: string,
    token?: string,
  ): Promise<{ data: Awaited<ReturnType<typeof getPublicReportCard>> | null; error: FetchError | null }> => {
    try {
      return { data: await getPublicReportCard(username, token), error: null };
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 410) return { data: null, error: "expired" };
      if (status === 403) return { data: null, error: "revoked" };
      return { data: null, error: "notfound" };
    }
  },
);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { username } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const { data } = await fetchCard(decodeURIComponent(username), token);
  if (!data) return { title: "Portfolio not found — Freelance Book" };
  const name = data.full_name || data.username;
  return {
    title: `${name} — Portfolio`,
    description: data.content?.bio_paragraphs?.[0] || `The portfolio of ${name}.`,
  };
}

export default async function PublicPortfolioRoute({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;
  const { data, error } = await fetchCard(decodeURIComponent(username), token);

  if (error === "revoked") {
    return (
      <CardNotice
        title="Share Link Revoked"
        message="The public share link for this portfolio has been removed or set to private by the author."
        actionHref="/"
        actionLabel="Back to Freelance Book"
      />
    );
  }

  if (error === "expired") {
    return (
      <CardNotice
        tone="warn"
        title="Share Link Expired"
        message="This temporary share link has exceeded its configured expiration period."
        actionHref="/"
        actionLabel="Back to Freelance Book"
      />
    );
  }

  if (!data) {
    return (
      <CardNotice
        title="Portfolio Not Found"
        message="This portfolio doesn't exist, or the share token is missing or invalid."
        actionHref="/"
        actionLabel="Back to Freelance Book"
      />
    );
  }

  return <PublicReportCardView data={data} shareToken={token} />;
}
