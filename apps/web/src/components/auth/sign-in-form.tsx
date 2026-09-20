"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import {
  AuthLink,
  AuthShell,
  ErrorBanner,
  Field,
  GithubIcon,
  GoogleIcon,
  PrimaryButton,
  SocialButton,
  SocialDivider,
} from "@/components/auth/parts";

type OAuth = "oauth_github" | "oauth_google";

/** Turn a Clerk API error into a single human-readable line. */
function clerkError(err: unknown): string {
  if (err && typeof err === "object" && "supportedErrorCodes" in err) {
    const codes = (err as { supportedErrorCodes?: { longMessage?: string }[] })
      .supportedErrorCodes;
    if (codes?.length) return codes[0].longMessage || "Something went wrong.";
  }
  if (err && typeof err === "object" && "errors" in err) {
    const errors = (err as { errors?: { longMessage?: string; message?: string }[] })
      .errors;
    if (errors?.length)
      return errors[0].longMessage || errors[0].message || "Something went wrong.";
  }
  return "Something went wrong. Please try again.";
}

type Mode = "login" | "forgot-email" | "forgot-code" | "forgot-password";

export function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoaded) return null;

  const finishSession = async (sessionId: string) => {
    try {
      await setActive({ session: sessionId });
    } catch {
      /* session may already be active — redirect either way */
    }
    router.replace("/dashboard");
  };

  /* ------------------------------ login ------------------------------ */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signIn.create({
        strategy: "password",
        identifier,
        password,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await finishSession(result.createdSessionId);
        return;
      }
      // Second factor or alternative requirement isn't handled by this form.
      setError("Additional verification is required. Please use email code or a social provider.");
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  /* --------------------------- oauth flow ---------------------------- */
  const oauth = async (strategy: OAuth) => {
    if (!signIn) return;
    setError(null);
    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setError(clerkError(err));
      setBusy(false);
    }
  };

  /* ------------------------ forgot password -------------------------- */
  const startReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError(null);
    setBusy(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier });
      setMode("forgot-code");
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError(null);
    setBusy(true);
    try {
      await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code });
      setMode("forgot-password");
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const completeReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signIn.resetPassword({ password: newPassword });
      if (result.status === "complete" && result.createdSessionId) {
        await finishSession(result.createdSessionId);
        return;
      }
      setMode("login");
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------- UI -------------------------------- */
  const titles: Record<Mode, { title: string; subtitle: string }> = {
    login: {
      title: "Login to your account",
      subtitle: "Enter your email below to login to your account",
    },
    "forgot-email": {
      title: "Reset your password",
      subtitle: "Enter your account email and we'll send you a reset code",
    },
    "forgot-code": {
      title: "Check your email",
      subtitle: `We sent a 6-digit code to ${identifier}. Enter it below.`,
    },
    "forgot-password": {
      title: "Choose a new password",
      subtitle: "Your new password must be at least 8 characters long",
    },
  };

  const footer =
    mode === "login" ? (
      <>
        Don&apos;t have an account? <AuthLink href="/sign-up">Sign up</AuthLink>
      </>
    ) : (
      <>
        Remembered it? <AuthLink href="/sign-in">Back to login</AuthLink>
      </>
    );

  let form: React.ReactNode;
  if (mode === "login") {
    form = (
      <form onSubmit={handleLogin} className="space-y-5" noValidate>
        <Field
          id="identifier"
          label="Email"
          type="email"
          placeholder="m@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="email"
          required
        />
        <Field
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          action={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-xs font-medium text-faint hover:text-fg"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        />
        <p className="-mt-2 text-right">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("forgot-email");
            }}
            className="text-sm font-bold text-fg underline underline-offset-4 hover:text-accent"
          >
            Forgot your password?
          </button>
        </p>
        <PrimaryButton loading={busy}>Login</PrimaryButton>
      </form>
    );
  } else if (mode === "forgot-email") {
    form = (
      <form onSubmit={startReset} className="space-y-5" noValidate>
        <Field
          id="identifier"
          label="Email"
          type="email"
          placeholder="m@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="email"
          required
        />
        <PrimaryButton loading={busy}>Send reset code</PrimaryButton>
      </form>
    );
  } else if (mode === "forgot-code") {
    form = (
      <form onSubmit={submitResetCode} className="space-y-5" noValidate>
        <Field
          id="code"
          label="Reset code"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoComplete="one-time-code"
          required
        />
        <PrimaryButton loading={busy}>Verify code</PrimaryButton>
      </form>
    );
  } else {
    form = (
      <form onSubmit={completeReset} className="space-y-5" noValidate>
        <Field
          id="new-password"
          label="New password"
          type="password"
          placeholder="Enter your new password (min 8 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PrimaryButton loading={busy}>Update password</PrimaryButton>
      </form>
    );
  }

  return (
    <AuthShell
      title={titles[mode].title}
      subtitle={titles[mode].subtitle}
      footer={footer}
      finePrint="Secured by Clerk · Encrypted JWT sessions"
    >
      <ErrorBanner message={error} />
      {form}

      {mode === "login" && (
        <>
          <SocialDivider />
          <SocialButton onClick={() => oauth("oauth_github")} disabled={busy} icon={<GithubIcon />}>
            Login with GitHub
          </SocialButton>
          <SocialButton onClick={() => oauth("oauth_google")} disabled={busy} icon={<GoogleIcon />}>
            Login with Google
          </SocialButton>
        </>
      )}
    </AuthShell>
  );
}
