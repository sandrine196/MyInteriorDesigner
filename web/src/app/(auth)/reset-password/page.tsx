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
          className="block text-center text-sm font-semibold hover:opacity-75 transition-opacity"
          style={{ color: "#1B4965" }}
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
          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
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
          className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full disabled:opacity-50 rounded-xl py-2.5 text-sm font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
        style={{ background: "#D4A574", color: "#1B4965" }}
      >
        {loading ? "Updating…" : "Set new password →"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Set new password</h1>
            <p className="text-sm text-stone-500 mt-1">Choose a strong password for your account</p>
          </div>

          <Suspense fallback={<p className="text-sm text-stone-400">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
