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
      {/* pinned: the bar stays full-width on this page — no glass-pill
          shrink on scroll */}
      <Navbar pinned />
      <div className="mk-docs dark flex-1">
        <NextProvider>
          {/* search/theme slots off: their empty boxes rendered at the
              bottom of the sidebar.
              No nav title: the site Navbar already shows it, and a
              `slots.navTitle` component is a function — it cannot be passed
              from this Server Component into the client tree. Leaving
              `nav.title` undefined makes fumadocs render an empty <a>, which
              globals.css hides. */}
          <DocsLayout
            tree={source.getPageTree()}
            searchToggle={{ enabled: false }}
            themeSwitch={{ enabled: false }}
          >
            {children}
          </DocsLayout>
        </NextProvider>
      </div>
    </LandingShell>
  );
}
