"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, saveToken, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email,             setEmail]             = useState("");
  const [password,          setPassword]          = useState("");
  const [marketingConsent,  setMarketingConsent]  = useState(false);
  const [error,             setError]             = useState("");
  const [loading,           setLoading]           = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await auth.register(email, password, marketingConsent);
      saveToken(token);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
      setLoading(false);
    }
  }

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
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Create your account</h1>
            <p className="text-sm text-stone-500 mt-1">5 free renders per month · No credit card needed</p>
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
              I'd like to receive design tips and exclusive furniture deals{" "}
              <span className="text-stone-400">(optional)</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
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
