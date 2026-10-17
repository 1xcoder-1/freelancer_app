"use client";

import { useCallback, useEffect, useRef } from "react";
import { recordLinkPageEvent, type PublicLinkPage } from "@/lib/api";
import { LinkPageRender, type LinkPageRenderItem } from "@/components/link-page/templates";

/* Client island for the server-rendered public page: the tree arrives in the
   initial HTML (no skeleton, no client fetch wait); this component only
   reports the view on mount and click events as visitors browse.

   Layout invariant: one card, one column, on every device — the tree renders
   fullscreen on mobile and as a centered floating card on desktop (recordEvents
   is off for live preview, where visits must not pollute analytics). */
export function PublicLinkPageView({
  page,
  recordEvents = true,
}: {
  page: PublicLinkPage;
  recordEvents?: boolean;
}) {
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!recordEvents || viewRecorded.current) return;
    viewRecorded.current = true;
    recordLinkPageEvent(page.slug, {
      event_type: "view",
      referrer: document.referrer || undefined,
    }).catch(() => {});
  }, [page.slug, recordEvents]);

  const onLinkClick = useCallback(
    (item: LinkPageRenderItem) => {
      if (!recordEvents) return;
      recordLinkPageEvent(page.slug, { event_type: "click", item_id: item.id }).catch(() => {});
    },
    [page.slug, recordEvents]
  );

  return (
    <main className="min-h-svh md:flex md:justify-center md:py-10 md:px-6">
      <div className="w-full min-h-svh flex flex-col md:min-h-0 md:h-[min(880px,calc(100svh-5rem))] md:w-[432px] md:rounded-[2rem] md:overflow-y-auto md:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] md:ring-1 md:ring-black/10 md:my-auto">
        <div className="flex flex-col grow [&>div]:min-h-full [&>div]:flex-1">
          <LinkPageRender
            template={page.template}
            data={{
              display_name: page.display_name,
              headline: page.headline,
              bio: page.bio,
              avatar_url: page.avatar_url,
              background_image_url: page.background_image_url,
              background_overlay: page.background_overlay,
              items: page.items,
            }}
            onLinkClick={onLinkClick}
          />
        </div>
      </div>
    </main>
  );
}
