"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLinkPages, type LinkPage } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { LinkPageBuilder } from "@/components/link-page/LinkPageBuilder";

const MAX_PAGES = 3;

/* Create a new tree — allowed only while under the 3-per-workspace limit
   (the API rejects a fourth with 409, this redirect keeps the UI honest). */
export default function NewLinkPageRoute() {
  const router = useRouter();

  const { data: pages, loading } = useApiData<LinkPage[]>(
    "linkpage:my",
    async (token) => getMyLinkPages(token),
    { reportContext: "link-page-new" }
  );

  useEffect(() => {
    if (!loading && (pages?.length ?? 0) >= MAX_PAGES) {
      router.replace("/dashboard/link-page");
    }
  }, [loading, pages, router]);

  if (loading || (pages?.length ?? 0) >= MAX_PAGES) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  return <LinkPageBuilder mode="new" />;
}
