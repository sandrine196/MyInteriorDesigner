"use client";
import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
          Missing reset token. Please use the link from your reset email.
        </p>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-sage-600 hover:text-sage-800 font-medium"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await auth.resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">
          New password{" "}
          <span className="text-stone-400 font-normal">(minimum 8 characters)</span>
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirm password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
      >
        {loading ? "Updating…" : "Set new password →"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-sage-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 14 14" fill="none" className="text-white">
              <rect x="1" y="5" width="5" height="8" rx="1" fill="currentColor" fillOpacity="0.85" />
              <rect x="8" y="2" width="5" height="11" rx="1" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">My Interior Designer</h1>
          <p className="text-sm text-stone-500 mt-1">Affordable AI interior design</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 space-y-5">
          <h2 className="text-lg font-semibold text-stone-900">Set new password</h2>
          <Suspense fallback={<p className="text-sm text-stone-400">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
