import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Landing route for the OAuth redirect (GitHub / Google) started from the
 * custom sign-in / sign-up forms. Clerk finishes the handshake here and then
 * sends the user to redirectUrlComplete (/dashboard).
 */
export default function SsoCallbackPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
