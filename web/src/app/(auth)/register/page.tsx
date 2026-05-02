"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, saveToken, ApiError } from "@/lib/api";

export default function RegisterPage() {
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
      const { token } = await auth.register(email, password);
      saveToken(token);
      router.push("/projects");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
      setLoading(false);
    }
  }

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

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 space-y-5">
          <h2 className="text-lg font-semibold text-stone-900">Create account</h2>
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
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
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
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "Creating account…" : "Create account →"}
          </button>
          <p className="text-sm text-center text-stone-500">
            Already have an account?{" "}
            <Link href="/login" className="text-sage-600 hover:text-sage-800 font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
