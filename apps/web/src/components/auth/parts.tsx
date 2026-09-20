import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for the 100% custom (no Clerk prebuilt UI)
 * sign-in / sign-up pages. Layout mirrors the reference design:
 * centered column on the bare page canvas — brand mark, big bold title,
 * gray subtitle, left-labeled fields, full-width accent button,
 * hairline "or continue with" divider, stacked social buttons and an
 * underlined cross-link at the bottom. Pure token classes, so light and
 * dark modes both stay perfect.
 */

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  finePrint,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  finePrint?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="mb-8 flex justify-center">
          <span className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-accent-fg text-lg font-black font-mono shadow-lg">
            fb
          </span>
        </div>

        {/* Header */}
        <h1 className="text-center font-display text-[28px] font-extrabold tracking-tight text-fg">
          {title}
        </h1>
        <p className="mt-2 text-center text-[15px] text-muted">{subtitle}</p>

        {/* Form column */}
        <div className="mt-8">{children}</div>

        {/* Cross-link */}
        <p className="mt-8 text-center text-sm text-fg">{footer}</p>
      </div>

      {finePrint && (
        <p className="mt-12 font-mono text-[10px] uppercase tracking-wider text-faint">
          {finePrint}
        </p>
      )}
    </div>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-bold text-fg underline underline-offset-4 hover:text-accent transition-colors"
    >
      {children}
    </Link>
  );
}

export function Field({
  id,
  label,
  action,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  /** Optional right-aligned element next to the label (e.g. forgot link) */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {action}
      </div>
      <input
        id={id}
        className="h-11 w-full rounded-lg border border-line-strong bg-card px-3.5 text-[15px] text-fg outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25"
        {...input}
      />
    </div>
  );
}

export function PrimaryButton({
  loading,
  children,
  ...button
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || button.disabled}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-bold text-accent-fg transition hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-60"
      {...button}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-5 rounded-lg border border-danger/25 bg-danger/10 px-3.5 py-3 text-sm font-medium text-danger"
    >
      {message}
    </div>
  );
}

export function SocialDivider() {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-faint">Or continue with</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function SocialButton({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line-strong bg-card text-[15px] font-semibold text-fg transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60",
        "mt-3"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Brand icons (inline SVG, colored like the real marks) ---------- */

export function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-fg" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.02 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.66.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.46h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.86c2.26-2.08 3.6-5.15 3.6-8.72Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.86-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.43-3.43A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l3.99 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}
