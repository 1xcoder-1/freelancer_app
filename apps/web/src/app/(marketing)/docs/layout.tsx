import { NextProvider } from "fumadocs-core/framework/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Navbar } from "@/components/landing/Navbar";
import { LandingShell } from "@/components/landing/layout";
import { source } from "@/lib/source";

/* Docs shell: the site's fixed Navbar stays on top (it renders its own
   h-16 spacer). Below it, fumadocs' DocsLayout provides the left page
   tree, the center column and the right "On this page" TOC.

   `mk-docs dark` scopes the always-dark fumadocs palette to the docs
   area only (see globals.css): --fd-banner-height pushes fumadocs'
   sticky sidebar/TOC offsets below the 64px navbar. */
export default function DocsRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LandingShell>
      <Navbar />
      <div className="mk-docs dark flex-1">
        <NextProvider>
          <DocsLayout tree={source.getPageTree()}>{children}</DocsLayout>
        </NextProvider>
      </div>
    </LandingShell>
  );
}
