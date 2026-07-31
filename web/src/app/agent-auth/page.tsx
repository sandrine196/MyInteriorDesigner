"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { agents, saveAgentToken, ApiError } from "@/lib/api";

function AgentAuthContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token") ?? "";

  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No sign-in token found. Please request a new link.");
      return;
    }

    agents.exchangeMagicToken(token)
      .then(({ token: sessionToken }) => {
        saveAgentToken(sessionToken);
        router.replace("/agent-dashboard");
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "This sign-in link is invalid or has expired. Please request a new one."
        );
      });
  // Only run once on mount — token doesn't change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F7F6F3" }}>
      <div className="w-full max-w-sm text-center space-y-6">

        <Link href="/">
          <Image src="/MIDLogoGold_Transparent.png" alt="My Interior Designer" width={100} height={102} className="h-12 w-auto object-contain mx-auto" priority />
        </Link>

        {!error ? (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 space-y-4">
            <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-[#D4A574] animate-spin mx-auto" />
            <p className="text-sm font-medium text-stone-700">Signing you in…</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 space-y-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto" style={{ background: "#FEF3C7" }}>
              ⚠️
            </div>
            <h1 className="text-lg font-bold text-stone-900">Link expired</h1>
            <p className="text-sm text-stone-500 leading-relaxed">{error}</p>
            <Link
              href="/agent-login"
              className="inline-block font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
              style={{ background: "#062C3D", color: "white" }}
            >
              Request a new link →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentAuthPage() {
  return (
    <Suspense>
      <AgentAuthContent />
    </Suspense>
  );
}
