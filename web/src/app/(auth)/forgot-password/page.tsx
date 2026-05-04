"use client";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { auth, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.requestReset(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #1B4965 0%, #2A5F7F 100%)" }}
    >
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div className="text-center pb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MIDLogo.png" alt="My Interior Designer" className="h-12 mx-auto mb-5 object-contain" />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Reset your password</h1>
            <p className="text-sm text-stone-500 mt-1">We'll send a reset link to your email</p>
          </div>

          {submitted ? (
            <div className="space-y-5 pt-1">
              <p className="text-sm text-stone-600 leading-relaxed text-center">
                If that email is registered, a reset link has been sent. Check your inbox.
              </p>
              <Link
                href="/login"
                className="block text-center text-sm font-semibold hover:opacity-75 transition-opacity"
                style={{ color: "#1B4965" }}
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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
              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
                style={{ background: "#D4A574", color: "#1B4965" }}
              >
                {loading ? "Sending…" : "Send reset link →"}
              </button>
              <p className="text-sm text-center pt-1">
                <Link
                  href="/login"
                  className="font-semibold hover:opacity-75 transition-opacity"
                  style={{ color: "#1B4965" }}
                >
                  ← Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
