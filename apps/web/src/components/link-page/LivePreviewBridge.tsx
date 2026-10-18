"use client";

import { useMemo } from "react";
import { PublicLinkPageView } from "@/components/link-page/PublicLinkPageView";
import { QrChip } from "@/components/link-page/QrChip";
import { ShareButton } from "@/components/link-page/ShareButton";
import { getTemplateBackdrop } from "@/components/link-page/template-constants";
import { useLivePreviewSubscriber, type PreviewPageState } from "@/hooks/use-live-preview";
import { decodePreviewToken } from "@/lib/preview-token";
import type { PublicLinkPage } from "@/lib/api";

/* Renders /p/{slug}?preview={token}: the same public page UI fed by the live
   WebSocket channel instead of published data. The SSR "initial" snapshot
   (owner's Clerk session, last saved state) paints first; the editor's WS
   stream then takes over and keeps it in sync. Views/clicks are never
   recorded in preview mode. */
export function LivePreviewBridge({
  slug,
  token,
  initial,
  qrSvg,
  publicUrl,
}: {
  slug: string;
  token: string;
  initial: PublicLinkPage | null;
  qrSvg: string;
  publicUrl: string;
}) {
  const pageId = useMemo(() => decodePreviewToken(token)?.page_id ?? null, [token]);
  const { state, status } = useLivePreviewSubscriber(pageId, token);

  const view: PreviewPageState | null = state ?? (initial ? publicPageToState(initial) : null);

  return (
    <div className="min-h-svh" style={{ background: getTemplateBackdrop(view?.template ?? "paper") }}>
      <ShareButton path={`/p/${slug}`} />
      <QrChip svg={qrSvg} publicUrl={publicUrl} />

      {view ? (
        <PublicLinkPageView
          recordEvents={false}
          page={{
            slug,
            display_name: view.display_name,
            headline: view.headline,
            bio: view.bio,
            avatar_url: view.avatar_url,
            theme: "default",
            template: view.template,
            background_image_url: view.background_image_url ?? null,
            background_overlay: view.background_overlay ?? null,
            items: view.items
              .filter((i) => i.active)
              .map((i) => ({
                id: i.id,
                label: i.label,
                url: i.url,
                item_type: i.item_type,
                icon: i.icon,
                description: i.description,
                image_url: i.image_url,
                sort_order: 0,
              })),
          }}
        />
      ) : (
        <div className="min-h-svh flex items-center justify-center p-8">
          <div className="text-center max-w-sm space-y-2">
            <div className="text-4xl">👀</div>
            <h1 className="font-display text-lg font-medium text-fg">
              {status === "offline" ? "This preview has ended" : "Connecting to the live preview…"}
            </h1>
            <p className="text-sm text-muted">
              {status === "offline"
                ? "Preview links expire after an hour — open a fresh preview from the editor."
                : "Open the editor in another tab and your changes will appear here instantly."}
            </p>
          </div>
        </div>
      )}

      {/* Subtle connection badge — reassures the owner the tab is live */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-md shadow-sm ${
            status === "live"
              ? "bg-black/55 text-white"
              : status === "connecting"
                ? "bg-black/40 text-white/80"
                : "bg-amber-500/85 text-amber-950"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "live"
                ? "bg-emerald-400 animate-pulse"
                : status === "connecting"
                  ? "bg-white/60"
                  : "bg-amber-900"
            }`}
          />
          {status === "live" ? "Live preview" : status === "connecting" ? "Connecting…" : "Preview offline"}
        </span>
      </div>
    </div>
  );
}

function publicPageToState(page: PublicLinkPage): PreviewPageState {
  return {
    display_name: page.display_name,
    headline: page.headline ?? null,
    bio: page.bio ?? null,
    avatar_url: page.avatar_url ?? null,
    template: page.template,
    background_image_url: page.background_image_url ?? null,
    background_overlay: page.background_overlay ?? null,
    items: page.items.map((i) => ({
      id: i.id,
      label: i.label,
      url: i.url,
      item_type: i.item_type,
      icon: i.icon ?? null,
      description: i.description ?? null,
      image_url: i.image_url ?? null,
      active: true,
    })),
  };
}
