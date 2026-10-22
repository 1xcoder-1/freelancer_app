"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLinkPages, type LinkPage } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { LinkPageBuilder } from "@/components/link-page/LinkPageBuilder";
import { usePlanCapacity } from "@/components/dashboard/PlanLimit";

/* Create a new tree — allowed only while the plan has room. The API refuses an
   over-cap create with 402; this redirect keeps the UI honest about it. */
export default function NewLinkPageRoute() {
  const router = useRouter();

  const { loading } = useApiData<LinkPage[]>(
    "linkpage:my",
    async (token) => getMyLinkPages(token),
    { reportContext: "link-page-new" }
  );
  const capacity = usePlanCapacity("link_pages");

  useEffect(() => {
    if (capacity.atLimit) {
      router.replace("/dashboard/link-page");
    }
  }, [capacity.atLimit, router]);

  if (loading || capacity.atLimit) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  return <LinkPageBuilder mode="new" />;
}
