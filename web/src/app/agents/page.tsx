"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { agents, ApiError } from "@/lib/api";

const HOW_IT_WORKS = [
  {
    icon: "🤝",
    title: "Join our partner programme",
    desc: "Sign up takes 2 minutes. You'll get a unique QR code and referral link immediately.",
  },
  {
    icon: "📱",
    title: "Share with your buyers",
    desc: "Give each buyer your unique QR code at point of sale or completion. Add it to your completion packs, email signature, or sales boards.",
  },
  {
    icon: "🏠",
    title: "They design their new home",
    desc: "Buyers upload their floor plan, choose their style, see AI renders, and shop furniture that fits — all as a gift from you.",
  },
];

const WHY_AGENTS = [
  "Completely free for you and your clients",
  "Memorable gift at completion — something they'll actually use",
  "Helps buyers feel excited about their new space",
  "Your brand stays top of mind after the sale",
  "Track how many clients use it from your dashboard",
  "No setup, no tech knowledge needed",
];

export default function AgentsPage() {
  const [name,       setName]       = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState<{ referralUrl: string; dashboardUrl: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await agents.register({ name, agencyName, email, phone: phone || undefined });
      setSuccess({ referralUrl: res.agent.referralUrl, dashboardUrl: res.agent.dashboardUrl });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — please try again");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5" aria-label="My Interior Designer home">
            <Image src="/MIDLogo.png" alt="My Interior Designer" width={120} height={84} className="h-9 w-auto object-contain" priority />
            <span className="font-semibold text-[#062C3D] tracking-tight hidden sm:block">My Interior Designer</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-2">
              Sign in
            </Link>
            <a
              href="#partner-form"
              className="bg-[#062C3D] hover:bg-[#051F2C] text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              Become a partner →
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="pt-16 min-h-[60vh] flex items-center"
        style={{ background: "linear-gradient(135deg, #062C3D 0%, #0D3F52 100%)" }}
      >
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest rounded-full px-4 py-2 mb-8"
            style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
            ESTATE AGENT PARTNER PROGRAMME
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-6">
            Turn floor plans into<br />
            <span style={{ color: "#D4A574" }}>home buying decisions</span>
          </h1>
          <p className="text-xl text-blue-100/80 leading-relaxed max-w-2xl mx-auto mb-10">
            Give every buyer a free AI interior design session.
            Zero cost to you. Memorable for them.
          </p>
          <a
            href="#partner-form"
            className="inline-flex items-center gap-2 font-semibold px-8 py-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
            style={{ background: "#D4A574", color: "#1B3050" }}
          >
            Become a partner agent →
          </a>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-stone-50" id="how-it-works">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">How it works</h2>
            <p className="text-stone-500 text-sm">Three simple steps — takes 2 minutes to set up.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="relative text-center">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden sm:block absolute top-8 left-[calc(50%+2.5rem)] right-[-50%] h-px bg-stone-300" />
                )}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 relative z-10 shadow-sm"
                  style={{ background: "white", border: "2px solid #D4A574" }}
                >
                  {step.icon}
                </div>
                <h3 className="font-semibold text-stone-900 mb-2">{step.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why agents love it ────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-4">
                Why agents love it
              </h2>
              <p className="text-stone-500 text-sm leading-relaxed mb-8">
                A unique, useful gift that sets you apart from every other agent —
                and keeps you in your clients&apos; lives long after completion day.
              </p>
              <ul className="space-y-3">
                {WHY_AGENTS.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-stone-700">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#062C3D" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Testimonial placeholder */}
            <div
              className="rounded-2xl p-8 border"
              style={{ background: "#EEF6F8", borderColor: "#AECFDB" }}
            >
              <svg className="w-8 h-8 mb-4" style={{ color: "#D4A574" }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
              <p className="text-stone-700 text-sm leading-relaxed italic mb-6">
                &ldquo;Our buyers love it — it really helps them visualise the potential of empty rooms.
                We send the QR code with every set of keys.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: "#062C3D" }}>
                  A
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Agent name — Agency name</p>
                  <p className="text-xs text-stone-400">Partner since 2025</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Registration form ─────────────────────────────────────────────── */}
      <section className="py-20 bg-stone-50" id="partner-form">
        <div className="max-w-lg mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">
              Become a partner agent
            </h2>
            <p className="text-stone-500 text-sm">
              Free to join. You&apos;ll get your QR code and referral link by email instantly.
            </p>
          </div>

          {success ? (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl"
                style={{ background: "#EEF6F8" }}>
                🎉
              </div>
              <h3 className="text-xl font-bold text-stone-900">You&apos;re in!</h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                Your account is ready. We&apos;ve sent a sign-in link to your email along with your QR code — click it to go straight to your dashboard.
              </p>
              <div className="bg-stone-50 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Your referral link</p>
                <p className="text-sm font-mono text-stone-800 break-all">{success.referralUrl}</p>
              </div>
              <Link
                href="/agent-login"
                className="inline-flex items-center gap-2 font-medium text-sm rounded-xl px-5 py-2.5 transition-colors"
                style={{ background: "#062C3D", color: "white" }}
              >
                Sign in to dashboard →
              </Link>
              <p className="text-xs text-stone-400">Didn&apos;t get the email? Request a new sign-in link above.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 space-y-5">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Your name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": "#D4A574" } as React.CSSProperties}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Agency name</label>
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Smith & Jones Estate Agents"
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@smithjones.co.uk"
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Phone <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07700 900000"
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-50 rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#062C3D", color: "white" }}
              >
                {loading ? "Joining…" : "Become a partner agent →"}
              </button>

              <p className="text-xs text-center text-stone-400 leading-relaxed">
                By signing up you agree to our{" "}
                <Link href="/terms" className="underline hover:text-stone-600">terms of service</Link>
                . We&apos;ll never share your details.
              </p>

              <div className="pt-2 border-t border-stone-100 text-center">
                <p className="text-xs text-stone-400">Already a partner?{" "}
                  <Link href="/agent-login" className="font-medium underline" style={{ color: "#062C3D" }}>
                    Sign in →
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-stone-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stone-400">
          <Link href="/" className="hover:text-stone-600 transition-colors">← Back to homepage</Link>
          <p>© {new Date().getFullYear()} MyInteriorDesigner.co.uk</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-stone-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-stone-600 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
