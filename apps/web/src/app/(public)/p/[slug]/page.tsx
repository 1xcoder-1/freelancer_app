import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import QRCode from "qrcode";
import { getMyLinkPages, getPublicLinkPage, type PublicLinkPage } from "@/lib/api";
import { PublicLinkPageView } from "@/components/link-page/PublicLinkPageView";
import { LivePreviewBridge } from "@/components/link-page/LivePreviewBridge";
import { QrChip } from "@/components/link-page/QrChip";
import { ShareButton } from "@/components/link-page/ShareButton";
import { getTemplateBackdrop } from "@/components/link-page/template-constants";

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

/* Reconstruct the public origin from proxy headers — the QR code must encode
   a URL that works after scanning, not the server's internal host. */
async function getPublicOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function isPreview(searchParams: Record<string, string | string[] | undefined>): boolean {
  return typeof searchParams.preview === "string" && searchParams.preview.length > 0;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  if (isPreview(sp)) {
    // A live preview must never be indexed or archived.
    return { title: "Live preview — Freelance Book", robots: { index: false, follow: false } };
  }
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

async function buildQr(svgUrl: string): Promise<string> {
  // SVG string is generated locally by the qrcode lib from the validated slug
  // URL only — no user-controlled markup reaches this sink.
  return QRCode.toString(svgUrl, {
    type: "svg",
    margin: 0,
    width: 128,
    color: { dark: "#18181b", light: "#00000000" },
  });
}

export default async function PublicLinkPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const previewToken = isPreview(sp) ? (sp.preview as string) : "";

  if (previewToken) {
    // Live preview: paint the owner's last-saved state instantly (Clerk
    // session cookie works in this tab), then let the editor's WS stream
    // take over. No published lookup — unpublished drafts never 404 here.
    let initial: PublicLinkPage | null = null;
    try {
      const { getToken } = await auth();
      const token = (await getToken()) || undefined;
      if (token) {
        const pages = await getMyLinkPages(token);
        const draft = pages.find((p) => p.slug === slug.trim().toLowerCase());
        if (draft) {
          initial = {
            slug: draft.slug,
            display_name: draft.display_name,
            headline: draft.headline,
            bio: draft.bio,
            avatar_url: draft.avatar_url,
            theme: draft.theme,
            template: draft.template,
            background_image_url: draft.background_image_url ?? null,
            background_overlay: draft.background_overlay ?? null,
            items: draft.items
              .filter((i) => i.active !== false)
              .map((i) => ({
                id: i.id,
                label: i.label,
                url: i.url,
                item_type: i.item_type,
                icon: i.icon,
                description: i.description,
                image_url: i.image_url,
                sort_order: i.sort_order,
              })),
          };
        }
      }
    } catch {
      initial = null;
    }

    const publicUrl = `${await getPublicOrigin()}/p/${slug}`;
    return (
      <LivePreviewBridge
        slug={slug}
        token={previewToken}
        initial={initial}
        qrSvg={await buildQr(publicUrl)}
        publicUrl={publicUrl}
      />
    );
  }

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

  const publicUrl = `${await getPublicOrigin()}/p/${page.slug}`;

  return (
    <div className="min-h-svh" style={{ background: getTemplateBackdrop(page.template) }}>
      <ShareButton path={`/p/${page.slug}`} />
      <QrChip svg={await buildQr(publicUrl)} publicUrl={publicUrl} />
      <PublicLinkPageView page={page} />
    </div>
  );
}
