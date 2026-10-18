"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLinkPages, type LinkPage } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { LinkPageBuilder } from "@/components/link-page/LinkPageBuilder";

/* Editor for one specific tree — /dashboard/link-page/edit/[id]. */
export default function EditLinkPageRoute() {
  const params = useParams();
  const pageId = (params?.id as string) || "";
  const router = useRouter();

  const { data: pages, loading } = useApiData<LinkPage[]>(
    "linkpage:my",
    async (token) => getMyLinkPages(token),
    { reportContext: "link-page-edit" }
  );

  const page = (pages ?? []).find((p) => p.id === pageId);

  useEffect(() => {
    if (!loading && !page) router.replace("/dashboard/link-page");
  }, [loading, page, router]);

  if (loading || !page) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  /* key remounts the builder whenever the page row changes elsewhere
     (publish from the dashboard, refresh) so form state re-seeds cleanly. */
  return <LinkPageBuilder key={page.updated_at} mode="edit" page={page} />;
}
