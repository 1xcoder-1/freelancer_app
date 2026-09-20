"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
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

type OAuth = "oauth_github" | "oauth_google";

export function SignUpForm() {
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { setActive, isLoaded: signInLoaded } = useSignIn();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"details" | "verify">("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signUpLoaded || !signInLoaded) return null;

  const activate = async (sessionId: string) => {
    try {
      await setActive({ session: sessionId });
    } catch {
      /* session may already be active — redirect either way */
    }
    router.replace("/dashboard");
  };

  /* ----------------------------- sign up ------------------------------ */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signUp.create({
        firstName,
        lastName,
        emailAddress,
        password,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await activate(result.createdSessionId);
        return;
      }
      if (result.status === "missing_requirements") {
        // Instance requires email verification — send the 6-digit code.
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
        return;
      }
      setError("We couldn't create your account. Please try again.");
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete" && result.createdSessionId) {
        await activate(result.createdSessionId);
        return;
      }
      setError(clerkError(result));
    } catch (err) {
      setError(clerkError(err));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (!signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch {
      /* silent — the code was already sent */
    }
  };

  /* --------------------------- oauth flow ----------------------------- */
  const oauth = async (strategy: OAuth) => {
    if (!signUp) return;
    setError(null);
    setBusy(true);
    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setError(clerkError(err));
      setBusy(false);
    }
  };

  /* ------------------------------- UI --------------------------------- */
  const header =
    step === "details"
      ? {
          title: "Create your account",
          subtitle: "Enter your details below to create your account",
        }
      : {
          title: "Verify your email",
          subtitle: `We sent a 6-digit code to ${emailAddress}. Enter it below.`,
        };

  const form =
    step === "details" ? (
      <form onSubmit={handleCreate} className="space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field
            id="firstName"
            label="First Name"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
          <Field
            id="lastName"
            label="Last Name"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>
        <Field
          id="emailAddress"
          label="Email"
          type="email"
          placeholder="m@example.com"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          autoComplete="email"
          required
        />
        <Field
          id="password"
          label="Password"
          type="password"
          placeholder="Enter your password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {/*
          Clerk Smart CAPTCHA mount point. Must exist in the DOM before
          signUp.create() / OAuth redirects run, otherwise Clerk falls back to
          the deprecated Invisible widget and logs a console warning. Renders
          nothing unless the visitor is flagged as a bot. See:
          https://clerk.com/docs/guides/development/custom-flows/bot-sign-up-protection
        */}
        <div id="clerk-captcha" data-cl-theme="auto" />
        <PrimaryButton loading={busy}>Create Account</PrimaryButton>
      </form>
    ) : (
      <form onSubmit={handleVerify} className="space-y-5" noValidate>
        <Field
          id="code"
          label="Verification code"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoComplete="one-time-code"
          required
        />
        <PrimaryButton loading={busy}>Verify email</PrimaryButton>
        <button
          type="button"
          onClick={resendCode}
          className="w-full text-center text-sm font-medium text-faint underline underline-offset-4 hover:text-fg"
        >
          Didn&apos;t get the code? Resend
        </button>
      </form>
    );

  return (
    <AuthShell
      title={header.title}
      subtitle={header.subtitle}
      footer={
        <>
          Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
      finePrint="No credit card required · Instant workspace setup"
    >
      <ErrorBanner message={error} />
      {form}

      {step === "details" && (
        <>
          <SocialDivider />
          <SocialButton onClick={() => oauth("oauth_github")} disabled={busy} icon={<GithubIcon />}>
            Register with GitHub
          </SocialButton>
          <SocialButton onClick={() => oauth("oauth_google")} disabled={busy} icon={<GoogleIcon />}>
            Register with Google
          </SocialButton>
        </>
      )}
    </AuthShell>
  );
}
