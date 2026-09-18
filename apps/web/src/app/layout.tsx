import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { BackToTop } from "@/components/ui/BackToTop";
import { CookieBanner } from "@/components/ui/CookieBanner";
import { FloatingContact } from "@/components/ui/FloatingContact";
import { UtmTracker } from "@/components/providers/UtmTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://freelance-book.app"),
  title: {
    default: "Freelance Book — The Complete Operating System for Freelancers",
    template: "%s | Freelance Book OS",
  },
  description:
    "Unified operating system for independent freelancers: Projects, Client CRM, Time Tracking, Invoices, Contracts, Daily Focus, and AI Copilot.",
  keywords: [
    "freelancer operating system",
    "freelance CRM",
    "freelance project management",
    "time tracking software",
    "free invoice generator",
    "Cloudflare D1",
    "FastAPI",
  ],
  authors: [{ name: "Freelance Book Team" }],
  creator: "Freelance Book",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://freelance-book.app",
    title: "Freelance Book — The Complete Freelancer OS",
    description:
      "Unify project management, client CRM, time tracking, invoices, daily focus, and Book AI into one seamless product.",
    siteName: "Freelance Book OS",
  },
  twitter: {
    card: "summary_large_image",
    title: "Freelance Book — Complete Freelancer OS",
    description: "The complete operating system for independent freelancers.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Freelance Book OS",
  operatingSystem: "Web, Windows, Android",
  applicationCategory: "BusinessApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description:
    "Unified operating system for independent freelancers: Client CRM, Kanban, Time Tracking, PDF Invoices, and Book AI Assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      >
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans">
          {/* Skip to Content Accessibility Link (Checklist Item) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-[200] px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl focus:outline-none"
          >
            Skip to main content
          </a>

          {/* UTM Tracking Capture */}
          <UtmTracker />

          {/* Top Scroll Progress Bar */}
          <ScrollProgress />

          {/* Main Application Page Content */}
          <div id="main-content" className="flex-1 flex flex-col">
            {children}
          </div>

          {/* Back to Top Smooth Button */}
          <BackToTop />

          {/* Floating Support Modal Trigger */}
          <FloatingContact />

          {/* GDPR Cookie Consent Banner */}
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
