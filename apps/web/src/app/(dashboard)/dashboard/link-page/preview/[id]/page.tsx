import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getMyLinkPages, type LinkPage } from "@/lib/api";
import { PreviewClientView } from "@/components/link-page/PreviewClientView";

/* Full-page interactive preview of one link tree — server-rendered and hydrated with
   instant Mobile and Desktop view switcher, authentic live styling, and no extra text clutter. */
export const dynamic = "force-dynamic";

export default async function PreviewLinkPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { getToken } = await auth();
  const token = (await getToken()) || undefined;

  let page: LinkPage | undefined;
  try {
    const pages = await getMyLinkPages(token);
    page = pages.find((p) => p.id === id);
  } catch {
    page = undefined;
  }

  if (!page) redirect("/dashboard/link-page");

  return <PreviewClientView page={page} />;
}
