"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { agents, ApiError } from "@/lib/api";

export default function AgentLoginPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await agents.requestMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F7F6F3" }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image src="/MIDLogo.png" alt="My Interior Designer" width={140} height={98} className="h-12 w-auto object-contain" priority />
          </Link>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto" style={{ background: "#EEF6F8" }}>
              ✉️
            </div>
            <h1 className="text-xl font-bold text-stone-900">Check your inbox</h1>
            <p className="text-sm text-stone-500 leading-relaxed">
              We&apos;ve sent a sign-in link to <strong className="text-stone-700">{email}</strong>.
              Click the link in the email to access your dashboard.
            </p>
            <p className="text-xs text-stone-400">The link expires in 15 minutes. Check your spam folder if it doesn&apos;t arrive.</p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-sm text-stone-500 underline hover:text-stone-700"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-stone-900">Partner sign in</h1>
              <p className="text-sm text-stone-500 mt-1">We&apos;ll send you a one-click sign-in link — no password needed.</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-50 rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
                style={{ background: "#062C3D", color: "white" }}
              >
                {loading ? "Sending…" : "Send sign-in link →"}
              </button>
            </form>

            <div className="pt-2 border-t border-stone-100 text-center space-y-2">
              <p className="text-xs text-stone-400">Not a partner yet?</p>
              <Link href="/agents" className="text-xs font-medium underline" style={{ color: "#062C3D" }}>
                Join the partner programme →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
