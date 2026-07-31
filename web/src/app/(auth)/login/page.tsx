"use client";
import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, saveToken, ApiError } from "@/lib/api";

function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  if (!searchParams.get("reset")) return null;
  return (
    <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 border border-green-200">
      Password updated — please sign in with your new password.
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await auth.login(email, password);
      saveToken(token);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
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
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div className="text-center pb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MIDLogo.png" alt="My Interior Designer" className="h-12 mx-auto mb-5 object-contain" />
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Sign in</h1>
            <p className="text-sm text-stone-500 mt-1">Welcome back</p>
          </div>

          <Suspense>
            <ResetSuccessBanner />
          </Suspense>

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
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
            style={{ background: "#D4A574", color: "#1B4965" }}
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>

          <div className="flex items-center justify-between text-sm pt-1">
            <p className="text-stone-500">
              New here?{" "}
              <Link href="/register" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: "#1B4965" }}>
                Create account
              </Link>
            </p>
            <Link href="/forgot-password" className="text-stone-400 hover:text-stone-600 transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Estate agents authenticate separately (magic link, no password).
              Without this pointer the natural instinct — sign in here — dead-ends
              in the homeowner app with no hint the partner dashboard exists. */}
          <div className="pt-4 mt-1 border-t border-stone-100">
            <p className="text-xs text-center text-stone-400">
              Estate agent partner?{" "}
              <Link href="/agent-login" className="font-semibold hover:opacity-75 transition-opacity" style={{ color: "#1B4965" }}>
                Sign in here →
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
