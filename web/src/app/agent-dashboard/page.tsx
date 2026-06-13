"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { agents, type AgentDashboard, ApiError, getAgentToken, clearAgentToken } from "@/lib/api";
import { config } from "@/config";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border"
      style={copied
        ? { background: "#EEF6F8", color: "#062C3D", borderColor: "#AECFDB" }
        : { background: "white", color: "#062C3D", borderColor: "#D4A574" }}
    >
      {copied ? (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied!</>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
      )}
    </button>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-6 text-center shadow-sm">
      <p className="text-4xl font-bold mb-1" style={{ color: "#062C3D" }}>{value}</p>
      <p className="text-sm font-semibold text-stone-700">{label}</p>
      <p className="text-xs text-stone-400 mt-1">{sub}</p>
    </div>
  );
}

function AgentDashboardContent() {
  const router = useRouter();

  const [data,    setData]    = useState<AgentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!getAgentToken()) {
      router.replace("/agent-login");
      return;
    }
    agents.dashboard()
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          clearAgentToken();
          router.replace("/agent-login");
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    clearAgentToken();
    router.replace("/agent-login");
  }

  const qrDownloadUrl = data ? `${config.apiUrl}/agents/qr?code=${encodeURIComponent(data.referralCode)}` : "";

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/MIDLogo.png" alt="My Interior Designer" width={120} height={84} className="h-9 w-auto object-contain" priority />
            <span className="font-semibold text-[#062C3D] tracking-tight hidden sm:block text-sm">Partner Dashboard</span>
          </Link>
          <button
            onClick={signOut}
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-[#D4A574] animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <Link href="/agents" className="text-sm font-medium underline" style={{ color: "#062C3D" }}>
              Join the partner programme →
            </Link>
          </div>
        )}

        {data && (
          <div className="space-y-8">
            {/* Greeting */}
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">{data.name}</h1>
              <p className="text-stone-500 text-sm mt-0.5">{data.agencyName}</p>
              {data.status === "pending" && (
                <span className="inline-flex items-center gap-1 text-xs font-medium mt-2 px-2.5 py-1 rounded-full"
                  style={{ background: "#FEF3C7", color: "#92400E" }}>
                  ⏳ Account pending activation
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Clients referred" value={data.clientsReferred} sub="buyers who signed up via your link" />
              <StatCard label="Designs created" value={data.designsCreated}  sub="AI renders your clients have generated" />
            </div>

            {/* Referral link */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-stone-900">Your referral link</h2>
              <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-3 border border-stone-200">
                <p className="text-sm font-mono text-stone-700 break-all flex-1">{data.referralUrl}</p>
                <CopyButton text={data.referralUrl} />
              </div>
              <p className="text-xs text-stone-400">
                Share this link with buyers — they get a free design session as a gift from you.
              </p>
            </div>

            {/* QR code */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
              <h2 className="font-semibold text-stone-900 mb-4">Your QR code</h2>
              <div className="flex flex-col sm:flex-row items-start gap-6">
                {data.qrDataUrl && (
                  <div className="rounded-xl overflow-hidden border border-stone-200 p-2 bg-white shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.qrDataUrl} alt="QR code" className="w-40 h-40" />
                  </div>
                )}
                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-700 mb-1">Share your assets</h3>
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Print your QR code and add it to completion packs, sale boards, or your email signature.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={qrDownloadUrl}
                      download={`mid-qr-${data.referralCode}.png`}
                      className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl transition-colors border"
                      style={{ background: "#062C3D", color: "white", borderColor: "#062C3D" }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download QR (PNG)
                    </a>
                    <CopyButton text={data.referralUrl} />
                  </div>
                  <p className="text-xs text-stone-400">
                    Want a print-ready PDF? Email us at{" "}
                    <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">hello@myinteriordesigner.co.uk</a>
                    {" "}with your agency name.
                  </p>
                </div>
              </div>
            </div>

            {/* Virtual staging CTA */}
            <div
              className="rounded-2xl p-6 border flex flex-col sm:flex-row items-start sm:items-center gap-5"
              style={{ background: "linear-gradient(135deg, #062C3D 0%, #0D3F52 100%)", borderColor: "#1B5272" }}
            >
              <div className="flex-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest rounded-full px-2.5 py-1 mb-2"
                  style={{ background: "rgba(212,165,116,0.2)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
                  NEW — AGENT EXCLUSIVE
                </div>
                <h2 className="font-bold text-white text-base mb-1">Virtual staging for your listings</h2>
                <p className="text-blue-100/70 text-sm leading-relaxed">
                  Generate photorealistic furnished room renders for empty properties — no real furniture needed.
                  Perfect for listing photos and buyer packs. 15 styles available.
                </p>
              </div>
              <Link
                href="/agent-dashboard/staging"
                className="inline-flex items-center gap-2 font-semibold text-sm px-5 py-3 rounded-xl transition-all shrink-0 active:scale-95"
                style={{ background: "#D4A574", color: "#1B3050" }}
              >
                Stage a room →
              </Link>
            </div>

            {/* How it works reminder */}
            <div className="rounded-2xl p-6 border" style={{ background: "#EEF6F8", borderColor: "#AECFDB" }}>
              <h2 className="font-semibold text-stone-900 mb-3">How to use your link</h2>
              <ol className="space-y-2 text-sm text-stone-600">
                <li className="flex items-start gap-2"><span className="font-bold text-[#062C3D] shrink-0">1.</span>Share your QR code or link with buyers at point of sale or completion</li>
                <li className="flex items-start gap-2"><span className="font-bold text-[#062C3D] shrink-0">2.</span>Buyers create a free account and upload their floor plan</li>
                <li className="flex items-start gap-2"><span className="font-bold text-[#062C3D] shrink-0">3.</span>They get AI renders of their new home with real UK furniture</li>
                <li className="flex items-start gap-2"><span className="font-bold text-[#062C3D] shrink-0">4.</span>Your stats above update automatically as they design</li>
              </ol>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AgentDashboardPage() {
  return (
    <Suspense>
      <AgentDashboardContent />
    </Suspense>
  );
}
