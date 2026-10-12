"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicLinkPage, recordLinkPageEvent, type PublicLinkPage } from "@/lib/api";
import { LinkPageRender, type LinkPageRenderItem } from "@/components/link-page/templates";

export default function PublicLinkPageRoute() {
  const params = useParams();
  const slug = params?.slug as string;

  const [page, setPage] = useState<PublicLinkPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getPublicLinkPage(slug);
        if (cancelled) return;
        setPage(res);
        if (!viewRecorded.current) {
          viewRecorded.current = true;
          recordLinkPageEvent(slug, { event_type: "view", referrer: document.referrer || undefined }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const onLinkClick = useCallback(
    (item: LinkPageRenderItem) => {
      recordLinkPageEvent(slug, { event_type: "click", item_id: item.id }).catch(() => {});
    },
    [slug]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-24 w-24 rounded-full mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-8">
        <div className="text-center max-w-sm space-y-2">
          <div className="text-4xl">🔗</div>
          <h1 className="font-display text-xl font-medium text-fg">This page doesn&apos;t exist</h1>
          <p className="text-sm text-muted">The link page you tried to open was removed or hasn&apos;t been published yet.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <LinkPageRender
        template={page.template}
        data={{
          display_name: page.display_name,
          headline: page.headline,
          bio: page.bio,
          avatar_url: page.avatar_url,
          items: page.items,
        }}
        onLinkClick={onLinkClick}
      />
    </main>
  );
}
