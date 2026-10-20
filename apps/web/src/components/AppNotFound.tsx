import Link from "next/link";
import { Globe, Home } from "@/components/animated-icons";

// App-styled 404, shared by the root not-found page and the feature route
// guard (hidden features). Server-safe: no hooks, no client-only APIs.
export function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 py-16 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-danger" />
        Error 404
      </div>

      <div className="mt-6 w-16 h-16 rounded-2xl bg-accent-soft border border-accent/30 flex items-center justify-center shadow-sm">
        <Globe className="w-7 h-7 text-accent" />
      </div>

      <h1 className="mt-6 font-display text-2xl sm:text-3xl font-medium tracking-wide text-fg">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-muted max-w-sm leading-relaxed">
        The page you are looking for doesn&apos;t exist or isn&apos;t available on your account.
      </p>

      <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
        <Link
          href="/dashboard"
          className="press inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent text-accent-fg text-sm font-semibold shadow-sm hover:bg-accent-hi transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <Link
          href="/"
          className="press inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-line-strong text-fg text-sm font-semibold hover:bg-surface transition-colors"
        >
          Return to Home
        </Link>
      </div>

      <div className="mt-8 flex items-center gap-3 text-xs text-muted">
        <Link href="/dashboard/clients" className="hover:text-fg transition-colors">
          Clients
        </Link>
        <span className="text-line-strong">·</span>
        <Link href="/dashboard/projects" className="hover:text-fg transition-colors">
          Projects
        </Link>
        <span className="text-line-strong">·</span>
        <Link href="/dashboard/booking" className="hover:text-fg transition-colors">
          Booking
        </Link>
      </div>
    </div>
  );
}
