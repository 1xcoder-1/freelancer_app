import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Footer() {
  const footerSections = [
    {
      title: "Product & Modules",
      links: [
        { label: "Client CRM & Leads", href: "/features#crm" },
        { label: "Multi-View Projects", href: "/features#projects" },
        { label: "Time Tracking & Pomodoro", href: "/features#time" },
        { label: "PDF Invoices & Expenses", href: "/features#finance" },
        { label: "Windows Quick Capture", href: "/features#desktop" },
        { label: "Android Mobile App", href: "/features#mobile" },
      ],
    },
    {
      title: "Technology & Stack",
      links: [
        { label: "Cloudflare D1 Database", href: "/architecture#database" },
        { label: "Python FastAPI Backend", href: "/architecture#backend" },
        { label: "Clerk Auth & JWT", href: "/architecture#auth" },
        { label: "Cloudflare R2 Storage", href: "/architecture#storage" },
        { label: "Upstash Redis Cache", href: "/architecture#cache" },
        { label: "Next.js 16 Web App", href: "/architecture#frontend" },
      ],
    },
    {
      title: "AI & Automation",
      links: [
        { label: "Book AI Assistant", href: "/ai" },
        { label: "Auto Proposal Generator", href: "/ai#proposals" },
        { label: "Effective Hourly Rate", href: "/ai#rates" },
        { label: "Client Health Scoring", href: "/ai#health" },
        { label: "Invoice Term Drafting", href: "/ai#invoicing" },
      ],
    },
    {
      title: "Company & Resources",
      links: [
        { label: "About Our Mission", href: "/about" },
        { label: "Freelancer Manifesto", href: "/about#manifesto" },
        { label: "Pricing & Plans", href: "/pricing" },
        { label: "System Architecture", href: "/architecture" },
        { label: "Sign In", href: "/sign-in" },
        { label: "Create Account", href: "/sign-up" },
      ],
    },
  ];

  return (
    <footer className="border-t border-slate-900 bg-slate-950 text-slate-400 text-sm">
      {/* Top CTA Banner */}
      <div className="border-b border-slate-900 py-16 bg-gradient-to-b from-slate-950 to-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left max-w-xl">
            <div className="inline-flex mb-4">
              <Badge variant="emerald" className="px-3 py-1 text-xs font-semibold gap-2">
                <Sparkles className="w-3.5 h-3.5" /> 100% Free Core Operating System
              </Badge>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Ready to take control of your freelance business?
            </h3>
            <p className="text-slate-400 text-sm mt-2 font-normal">
              No credit card required. Free forever on Cloudflare D1 serverless edge database.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link href="/sign-up">
              <Button size="lg" className="rounded-xl font-bold px-6 shadow-xl shadow-emerald-500/20">
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/features">
              <Button variant="outline" size="lg" className="rounded-xl font-semibold px-6">
                Explore Modules
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Categorized Link Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
        {footerSections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {section.title}
            </h4>
            <ul className="space-y-2.5">
              {section.links.map((link, lIdx) => (
                <li key={lIdx}>
                  <Link
                    href={link.href}
                    className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-normal"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-900/80 py-8 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xs">
              FB
            </div>
            <span className="font-bold text-slate-300">Freelance Book 1.0 OS</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Built for Independent Freelancers & Consultants</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
