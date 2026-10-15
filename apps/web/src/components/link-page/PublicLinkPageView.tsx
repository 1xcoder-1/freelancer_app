"use client";

import { useCallback, useEffect, useRef } from "react";
import { recordLinkPageEvent, type PublicLinkPage } from "@/lib/api";
import { LinkPageRender, type LinkPageRenderItem } from "@/components/link-page/templates";

/* Client island for the server-rendered public page: the tree arrives in the
   initial HTML (no skeleton, no client fetch wait); this component only
   reports the view on mount and click events as visitors browse. */
export function PublicLinkPageView({ page }: { page: PublicLinkPage }) {
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (viewRecorded.current) return;
    viewRecorded.current = true;
    recordLinkPageEvent(page.slug, {
      event_type: "view",
      referrer: document.referrer || undefined,
    }).catch(() => {});
  }, [page.slug]);

  const onLinkClick = useCallback(
    (item: LinkPageRenderItem) => {
      recordLinkPageEvent(page.slug, { event_type: "click", item_id: item.id }).catch(() => {});
    },
    [page.slug]
  );

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
