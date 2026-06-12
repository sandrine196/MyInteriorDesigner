"use client";
import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, saveToken, ApiError } from "@/lib/api";

function RegisterForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const refCode      = searchParams.get("ref") ?? "";

  const [email,            setEmail]            = useState("");
  const [password,         setPassword]         = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error,            setError]            = useState("");
  const [loading,          setLoading]          = useState(false);

  // Persist ref code in sessionStorage so it survives page navigation
  useEffect(() => {
    if (refCode) sessionStorage.setItem("mid_ref", refCode);
  }, [refCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const storedRef = sessionStorage.getItem("mid_ref") ?? refCode ?? undefined;
    try {
      const { token } = await auth.register(email, password, marketingConsent, storedRef || undefined);
      if (storedRef) sessionStorage.removeItem("mid_ref");
      saveToken(token);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
      setLoading(false);
    }
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

          <button
            type="submit"
            disabled={loading}
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
