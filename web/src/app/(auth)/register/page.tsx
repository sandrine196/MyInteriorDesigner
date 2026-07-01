"use client";
import { useState, useRef, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { auth, saveToken, ApiError } from "@/lib/api";

// ── Check-email screen ───────────────────────────────────────────────────────

const EMAIL_PROVIDER_LINKS: Record<string, { label: string; url: string }> = {
  "gmail.com":       { label: "Open Gmail →",        url: "https://mail.google.com" },
  "googlemail.com":  { label: "Open Gmail →",        url: "https://mail.google.com" },
  "outlook.com":     { label: "Open Outlook →",      url: "https://outlook.live.com" },
  "hotmail.com":     { label: "Open Outlook →",      url: "https://outlook.live.com" },
  "hotmail.co.uk":   { label: "Open Outlook →",      url: "https://outlook.live.com" },
  "live.com":        { label: "Open Outlook →",      url: "https://outlook.live.com" },
  "live.co.uk":      { label: "Open Outlook →",      url: "https://outlook.live.com" },
  "yahoo.com":       { label: "Open Yahoo Mail →",   url: "https://mail.yahoo.com" },
  "yahoo.co.uk":     { label: "Open Yahoo Mail →",   url: "https://mail.yahoo.com" },
  "icloud.com":      { label: "Open iCloud Mail →",  url: "https://www.icloud.com/mail" },
  "me.com":          { label: "Open iCloud Mail →",  url: "https://www.icloud.com/mail" },
  "mac.com":         { label: "Open iCloud Mail →",  url: "https://www.icloud.com/mail" },
  "aol.com":         { label: "Open AOL Mail →",     url: "https://mail.aol.com" },
  "protonmail.com":  { label: "Open ProtonMail →",   url: "https://mail.proton.me" },
  "proton.me":       { label: "Open ProtonMail →",   url: "https://mail.proton.me" },
  "tutamail.com":    { label: "Open Tuta Mail →",    url: "https://app.tuta.com" },
  "tuta.com":        { label: "Open Tuta Mail →",    url: "https://app.tuta.com" },
};

function CheckEmailScreen({ email }: { email: string }) {
  const router = useRouter();
  const [resent,   setResent]   = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown,  setCooldown]  = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    try {
      await auth.resendVerification();
      setResent(true);
      setCooldown(60);
    } catch {
      // silently ignore — user can try again
    } finally {
      setResending(false);
    }
  }

  const domain = email.toLowerCase().split("@")[1] ?? "";
  const providerLink = EMAIL_PROVIDER_LINKS[domain];
  // Fallback: show both Gmail and Outlook for unknown providers
  const fallbackLinks = [
    { label: "Open Gmail →",   url: "https://mail.google.com" },
    { label: "Open Outlook →", url: "https://outlook.live.com" },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #1B4965 0%, #2A5F7F 100%)" }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/MIDLogo.png" alt="My Interior Designer" className="h-12 mx-auto object-contain" />

          <div className="text-5xl">📧</div>

          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>
              Check your email!
            </h1>
            <p className="text-sm text-stone-500 mt-2 leading-relaxed">
              We&apos;ve sent a verification link to:
            </p>
            <p className="text-sm font-semibold mt-1 break-all" style={{ color: "#1B4965" }}>
              {email}
            </p>
          </div>

          <p className="text-sm text-stone-500 leading-relaxed">
            Click the link in that email to activate your account and start generating designs.
          </p>

          {/* Tips */}
          <div className="bg-stone-50 rounded-xl px-5 py-4 text-left space-y-1.5">
            <p className="text-xs font-semibold text-stone-600 mb-2">Can&apos;t find it? Check:</p>
            <p className="text-xs text-stone-500">📁 Your spam / junk folder</p>
            <p className="text-xs text-stone-500">📂 Gmail &ldquo;Promotions&rdquo; tab</p>
            <p className="text-xs text-stone-500">⏱️ It may take 1–2 minutes to arrive</p>
          </div>

          {/* Resend */}
          {resent ? (
            <p className="text-sm text-green-600 font-medium">Email resent! Check your inbox.</p>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full border border-stone-200 rounded-xl py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
            </button>
          )}

          {/* Open email app */}
          <div className={`grid gap-2 ${providerLink ? "grid-cols-1" : "grid-cols-2"}`}>
            {providerLink ? (
              <a
                href={providerLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl py-2.5 text-sm font-semibold text-center transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#D4A574", color: "#1B4965" }}
              >
                {providerLink.label}
              </a>
            ) : (
              fallbackLinks.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl py-2.5 text-sm font-semibold text-center transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#D4A574", color: "#1B4965" }}
                >
                  {l.label}
                </a>
              ))
            )}
          </div>

          <button
            onClick={() => router.push("/")}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            I&apos;ll verify later →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Registration form ────────────────────────────────────────────────────────

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const refCode      = searchParams.get("ref") ?? "";

  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [honeypot,         setHoneypot]         = useState("");
  const [error,            setError]            = useState("");
  const [loading,          setLoading]          = useState(false);
  const [cfToken,          setCfToken]          = useState("");
  const [registeredEmail,  setRegisteredEmail]  = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    if (refCode) sessionStorage.setItem("mid_ref", refCode);
  }, [refCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const storedRef = sessionStorage.getItem("mid_ref") ?? refCode ?? undefined;
    try {
      const { token } = await auth.register(email, password, marketingConsent, storedRef || undefined, honeypot || undefined, cfToken);
      if (storedRef) sessionStorage.removeItem("mid_ref");
      saveToken(token);
      setRegisteredEmail(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
      setLoading(false);
      turnstileRef.current?.reset();
      setCfToken("");
    }
  }

  if (registeredEmail) {
    return <CheckEmailScreen email={registeredEmail} />;
  }

  const isReferred = !!(refCode || (typeof window !== "undefined" && sessionStorage.getItem("mid_ref")));

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #1B4965 0%, #2A5F7F 100%)" }}
    >
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div className="text-center pb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MIDLogo.png" alt="My Interior Designer" className="h-12 mx-auto mb-5 object-contain" />
            {isReferred ? (
              <>
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3">
                  <span className="text-lg">🎁</span>
                  <span className="text-sm font-semibold text-amber-800">Gift from your estate agent</span>
                </div>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Create your free account</h1>
                <p className="text-sm text-stone-500 mt-1 leading-relaxed">
                  Your estate agent has given you free access to AI interior design.
                  Get started and see your new home come to life.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Create your account</h1>
                <p className="text-sm text-stone-500 mt-1">5 free renders per month · No credit card needed</p>
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Password{" "}
              <span className="text-stone-400 font-normal">(minimum 8 characters)</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 rounded accent-mid-blue cursor-pointer"
            />
            <span className="text-xs text-stone-500 leading-relaxed group-hover:text-stone-700 transition-colors">
              I&apos;d like to receive design tips and exclusive furniture deals{" "}
              <span className="text-stone-400">(optional)</span>
            </span>
          </label>

          {/* Honeypot — hidden from humans, filled by bots */}
          <input
            type="text"
            name="phone_number"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ display: "none" }}
          />

          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
            onSuccess={setCfToken}
            onError={() => setCfToken("")}
            onExpire={() => setCfToken("")}
            options={{ theme: "light", size: "flexible" }}
          />

          <button
            type="submit"
            disabled={loading || !cfToken}
            className="w-full disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: "#D4A574", color: "#1B4965" }}
          >
            {loading ? "Creating account…" : "Create account →"}
          </button>

          <p className="text-sm text-center text-stone-500 pt-1">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: "#1B4965" }}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
