import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-bg">
      {children}
      {/*
        Clerk Smart CAPTCHA mount point for custom flows (email sign-up, Google/GitHub OAuth, SSO callback).
        Must be present in the static DOM on all auth routes to prevent the
        "clerk-captcha DOM element was not found" error during OAuth & custom sign-up.
      */}
      <div id="clerk-captcha" data-cl-theme="auto" className="flex justify-center" />
    </div>
  );
}
