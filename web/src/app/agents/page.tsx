"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { agents, ApiError } from "@/lib/api";

const PERKS = [
  { icon: "🏠", title: "Virtual staging", desc: "Stage empty rooms with AI in seconds. Use the renders in your listings." },
  { icon: "🎁", title: "Buyer gift", desc: "Give every buyer a free AI design session — memorable and completely free for you." },
  { icon: "📊", title: "Dashboard", desc: "Track how many clients sign up via your link and how many designs they create." },
];

export default function AgentsPage() {
  const [name,       setName]       = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [honeypot,   setHoneypot]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState<{ referralUrl: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await agents.register({ name, agencyName, email, phone: phone || undefined, phone_number: honeypot || undefined });
      setSuccess({ referralUrl: res.agent.referralUrl });
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
            <Link href="/agent-login" className="text-sm text-stone-500 hover:text-stone-900 transition-colors px-3 py-2">
              Already a partner? Sign in →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero + Form ──────────────────────────────────────────────────── */}
      <section
        className="pt-16 min-h-screen flex items-center"
        style={{ background: "linear-gradient(135deg, #062C3D 0%, #0D3F52 100%)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-16 w-full grid lg:grid-cols-2 gap-12 items-center">

          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest rounded-full px-4 py-2 mb-6"
              style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
              ESTATE AGENT PARTNER PROGRAMME
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-5">
              AI tools for<br />
              <span style={{ color: "#D4A574" }}>estate agents</span>
            </h1>
            <p className="text-lg text-blue-100/75 leading-relaxed max-w-md">
              Stage empty rooms in seconds, give buyers a memorable gift at completion,
              and track your referrals — all from one free dashboard.
            </p>
          </div>

          {/* Right — form */}
          <div>
            {success ? (
              <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl"
                  style={{ background: "#EEF6F8" }}>
                  🎉
                </div>
                <h3 className="text-xl font-bold text-stone-900">You&apos;re in!</h3>
                <p className="text-sm text-stone-500 leading-relaxed">
                  Your account is ready. We&apos;ve sent a sign-in link to your email — click it to go straight to your dashboard.
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
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-stone-900 mb-0.5">Create your partner account</h2>
                  <p className="text-xs text-stone-400">Free to join. Takes 2 minutes.</p>
                </div>

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
                      placeholder="Smith & Jones"
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full disabled:opacity-50 rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#062C3D", color: "white" }}
                >
                  {loading ? "Joining…" : "Create my partner account →"}
                </button>

                <p className="text-xs text-center text-stone-400 leading-relaxed">
                  By signing up you agree to our{" "}
                  <Link href="/terms" className="underline hover:text-stone-600">terms of service</Link>.
                  We&apos;ll never share your details.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── What's included ──────────────────────────────────────────────── */}
      <section className="py-16 bg-stone-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-8 text-center">What&apos;s included</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {PERKS.map((p) => (
              <div key={p.title} className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="font-semibold text-stone-900 mb-1 text-sm">{p.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
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
