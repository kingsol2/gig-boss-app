import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { MembershipCard } from "../components/domain";
import { Icon } from "../components/Icon";
import {
  Brand,
  ErrorState,
  IntegrationNotice,
  MultiSelectPlatforms,
  PasswordInput,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "../components/ui";
import { ROUTES } from "../lib/routes";
import { INTEGRATION_MESSAGES } from "../services/interfaces";
import { useAppState } from "../state/AppContext";
import { useRouter } from "../state/RouterContext";
import type { GigPlatform, MembershipTier } from "../types/models";

function AuthShell({
  eyebrow,
  title,
  description,
  children,
  loginLayout = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  loginLayout?: boolean;
}) {
  const embeddedPreview = loginLayout && window.self !== window.top;

  return (
    <main
      id="main-content"
      data-embedded-preview={embeddedPreview ? "true" : undefined}
      className={`app-viewport overflow-y-auto bg-[#080808] pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] text-white ${
        loginLayout ? "login-screen pt-0" : "pt-[max(32px,env(safe-area-inset-top))]"
      }`}
    >
      {loginLayout && <div className="login-safe-area" aria-hidden="true" />}
      <div className="mx-auto max-w-sm">
        {loginLayout ? (
          <header className="login-logo-header">
            <Brand />
          </header>
        ) : (
          <Brand />
        )}
        <div className={loginLayout ? "mt-8" : "mt-10"}>
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#EF233C]">
              {eyebrow}
            </p>
          )}
          <h1 className={`${eyebrow ? "mt-2" : ""} text-3xl font-black tracking-tight`}>
            {title}
          </h1>
          {description && <p className="mt-3 text-sm leading-6 text-[#A3A3A3]">{description}</p>}
        </div>
        <div className={loginLayout ? "mt-7" : "mt-8"}>{children}</div>
      </div>
    </main>
  );
}

export function SplashScreen() {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(ROUTES.login, { replace: true });
  }, [navigate]);

  return null;
}

export function LoginScreen() {
  const { navigate } = useRouter();
  const { startPreview, profile } = useAppState();
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.includes("@") || !password) return setError("Enter a valid email and password.");
    setError(INTEGRATION_MESSAGES.firebase);
  };

  const preview = () => {
    startPreview();
    navigate(profile.onboardingComplete ? ROUTES.dashboard : ROUTES.onboardingPlatforms);
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Your earnings. Your expenses. Your profit."
      loginLayout
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <TextInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            className="pr-12"
            onChange={(e) => setEmail(e.target.value)}
          />
          <span
            className="pointer-events-none absolute right-2 top-7 flex h-11 w-11 items-center justify-center text-black"
            aria-hidden="true"
          >
            <Icon name="mail" />
          </span>
        </div>
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorState message={error} />}
        <button
          type="button"
          className="block w-full text-right text-sm font-bold text-[#EF233C]"
          onClick={() => navigate(ROUTES.forgotPassword)}
        >
          Forgot password?
        </button>
        <PrimaryButton type="submit">Log in with Firebase</PrimaryButton>
      </form>
      <div className="my-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#555]">
        <span className="h-px flex-1 bg-white/10" />
        Local preview
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <SecondaryButton onClick={preview}>Continue in local preview</SecondaryButton>
      <p className="mt-3 text-center text-xs leading-5 text-[#777]">
        Local preview is not authentication and is not cloud-secured.
      </p>
      <p className="mt-8 text-center text-sm text-[#A3A3A3]">
        New to Gig Boss?{" "}
        <button className="font-bold text-white" onClick={() => navigate(ROUTES.signup)}>
          Create account
        </button>
      </p>
    </AuthShell>
  );
}

export function SignUpScreen() {
  const { navigate } = useRouter();
  const { updateProfile, startPreview } = useAppState();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [error, setError] = useState("");

  const validate = () => {
    if (form.name.trim().length < 2) return "Enter your full name.";
    if (!form.email.includes("@")) return "Enter a valid email.";
    if (form.password.length < 12) return "Password must be at least 12 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (!form.terms) return "Accept the terms to continue.";
    return "";
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(validate() || INTEGRATION_MESSAGES.firebase);
  };
  const preview = () => {
    const validation = validate();
    if (validation) return setError(validation);
    updateProfile({ fullName: form.name.trim(), email: form.email.trim() });
    startPreview();
    navigate(ROUTES.verifyEmail);
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title="Start tracking profit."
      description="Firebase is required to create a real account. You can still validate this flow in local preview."
    >
      <form className="space-y-4" onSubmit={submit}>
        <TextInput
          label="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoComplete="name"
        />
        <TextInput
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
        />
        <PasswordInput
          label="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="new-password"
          hint="At least 12 characters"
        />
        <PasswordInput
          label="Confirm password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          autoComplete="new-password"
        />
        <label className="flex items-start gap-3 text-sm leading-5 text-[#A3A3A3]">
          <input
            type="checkbox"
            className="mt-1 accent-[#EF233C]"
            checked={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.checked })}
          />
          <span>I accept the Terms of Service and Privacy Policy.</span>
        </label>
        {error && <ErrorState message={error} />}
        <PrimaryButton type="submit">Create account with Firebase</PrimaryButton>
        <SecondaryButton type="button" onClick={preview}>
          Continue signup preview
        </SecondaryButton>
      </form>
      <button
        className="mt-6 w-full text-sm font-bold text-[#A3A3A3]"
        onClick={() => navigate(ROUTES.login)}
      >
        Return to login
      </button>
    </AuthShell>
  );
}

export function ForgotPasswordScreen() {
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password."
      description="A reset email can be sent after Firebase Authentication is connected."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(
            email.includes("@") ? INTEGRATION_MESSAGES.firebase : "Enter a valid email address.",
          );
        }}
      >
        <TextInput
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {error && <ErrorState message={error} />}
        <PrimaryButton type="submit">Send reset instructions</PrimaryButton>
      </form>
      <SecondaryButton className="mt-3" onClick={() => navigate(ROUTES.login)}>
        Return to login
      </SecondaryButton>
    </AuthShell>
  );
}

export function EmailVerificationScreen() {
  const { navigate } = useRouter();
  const { profile, endPreview } = useAppState();
  const [message, setMessage] = useState("");
  return (
    <AuthShell
      eyebrow="Verify email"
      title="Check your inbox."
      description="We’ll use email verification once Firebase Authentication is connected."
    >
      <div className="rounded-2xl border border-white/10 bg-[#181818] p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[#777]">Registered email</p>
        <p className="mt-2 font-bold">{profile.email || "No email entered"}</p>
      </div>
      {message && (
        <div className="mt-4">
          <ErrorState message={message} />
        </div>
      )}
      <div className="mt-5 space-y-3">
        <PrimaryButton onClick={() => setMessage(INTEGRATION_MESSAGES.firebase)}>
          Check verification status
        </PrimaryButton>
        <SecondaryButton onClick={() => setMessage(INTEGRATION_MESSAGES.firebase)}>
          Resend verification
        </SecondaryButton>
        <SecondaryButton onClick={() => navigate(ROUTES.onboardingPlatforms)}>
          Continue local preview
        </SecondaryButton>
        <button
          className="w-full py-3 text-sm font-bold text-[#A3A3A3]"
          onClick={() => {
            endPreview();
            navigate(ROUTES.login);
          }}
        >
          Sign out of preview
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-[#777]">
        Continuing local preview does not mark your email verified.
      </p>
    </AuthShell>
  );
}

export function PlatformSelectionScreen() {
  const { profile, setPlatforms } = useAppState();
  const { navigate } = useRouter();
  const [platforms, setLocalPlatforms] = useState<GigPlatform[]>(profile.platforms);
  const [error, setError] = useState("");
  const save = () => {
    if (!platforms.length) return setError("Select at least one platform.");
    setPlatforms(platforms);
    navigate(ROUTES.onboardingMembership);
  };
  return (
    <AuthShell
      eyebrow="Step 1 of 3"
      title="Where do you drive?"
      description="Select every platform you want to compare. You can change these later."
    >
      <MultiSelectPlatforms value={platforms} onChange={setLocalPlatforms} />
      {error && (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      )}
      <PrimaryButton className="mt-6" onClick={save}>
        Save and continue
      </PrimaryButton>
    </AuthShell>
  );
}

export function MembershipSelectionScreen() {
  const { profile, setMembership } = useAppState();
  const { navigate } = useRouter();
  const [tier, setTier] = useState<MembershipTier>(profile.membership.tier);
  const save = () => {
    setMembership(tier);
    navigate(ROUTES.onboardingConsent);
  };
  return (
    <AuthShell
      eyebrow="Step 2 of 3"
      title="Choose membership."
      description="This selection is local only. VIP checkout will require an authorized Stripe integration."
    >
      <div className="space-y-3">
        <MembershipCard tier="free" selected={tier === "free"} onSelect={() => setTier("free")} />
        <MembershipCard tier="vip" selected={tier === "vip"} onSelect={() => setTier("vip")} />
      </div>
      <IntegrationNotice>
        <strong className="text-white">No assumed VIP benefits.</strong> Entitlements remain
        centrally configurable until approved.
      </IntegrationNotice>
      <PrimaryButton className="mt-6" onClick={save}>
        Select {tier === "vip" ? "VIP" : "Free"} and continue
      </PrimaryButton>
    </AuthShell>
  );
}

export function ConsentScreen() {
  const { preferences, setConsent } = useAppState();
  const { navigate } = useRouter();
  const [allowed, setAllowed] = useState(preferences.screenshotConsent.allowed);
  const save = () => {
    setConsent(allowed);
    navigate(ROUTES.onboardingComplete);
  };
  return (
    <AuthShell
      eyebrow="Step 3 of 3"
      title="Screenshot processing."
      description="Gig Boss can later send delivery screenshots to an approved processing service to extract fields for your review."
    >
      <div className="space-y-3">
        <button
          className={`choice-row ${allowed ? "choice-row-active" : ""}`}
          onClick={() => setAllowed(true)}
        >
          <span>
            <strong>Allow processing</strong>
            <small>Screenshots may be sent to the future processing provider.</small>
          </span>
          <span className="radio-dot">{allowed && <span />}</span>
        </button>
        <button
          className={`choice-row ${!allowed ? "choice-row-active" : ""}`}
          onClick={() => setAllowed(false)}
        >
          <span>
            <strong>Manual entry only</strong>
            <small>No screenshot processing consent. Manual entry remains available.</small>
          </span>
          <span className="radio-dot">{!allowed && <span />}</span>
        </button>
      </div>
      <p className="mt-5 text-xs leading-5 text-[#777]">
        Consent is stored only on this device in preview and can be changed in Privacy & Data.
      </p>
      <PrimaryButton className="mt-6" onClick={save}>
        Save decision and continue
      </PrimaryButton>
    </AuthShell>
  );
}

export function OnboardingCompleteScreen() {
  const { profile, completeOnboarding } = useAppState();
  const { navigate } = useRouter();
  return (
    <AuthShell
      eyebrow="Setup complete"
      title={`You’re ready${profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}.`}
      description="Your local Gig Boss workspace is ready. Add a real delivery to begin calculating estimates."
    >
      <div className="rounded-2xl border border-[#48FF85]/20 bg-[#48FF85]/5 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-[#48FF85]">
          Selected platforms
        </p>
        <p className="mt-3 leading-7">{profile.platforms.join(" · ") || "None selected"}</p>
      </div>
      <PrimaryButton
        className="mt-6"
        onClick={() => {
          completeOnboarding();
          navigate(ROUTES.dashboard);
        }}
      >
        Go to dashboard
      </PrimaryButton>
      <p className="mt-4 text-center text-xs text-[#777]">
        Records in this preview are local to this browser and are not cloud synchronized.
      </p>
    </AuthShell>
  );
}
