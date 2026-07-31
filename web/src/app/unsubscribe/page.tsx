"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";

type State = "loading" | "success" | "invalid" | "error";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) { setState("invalid"); return; }

    auth.unsubscribe(token)
      .then(() => setState("success"))
      .catch((e) => {
        if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 400) {
          setState("invalid");
        } else {
          setState("error");
        }
      });
  }, [searchParams]);

  return (
    <>
      {state === "loading" && (
        <>
          <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-stone-600 animate-spin mx-auto" />
          <p className="text-sm text-stone-500">Updating your preferences…</p>
        </>
      )}

      {state === "success" && (
        <>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-stone-900">You&apos;ve been unsubscribed</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            You'll no longer receive marketing emails from My Interior Designer.
            Transactional emails (render ready, password reset) are unaffected.
          </p>
          <p className="text-xs text-stone-400">
            Changed your mind?{" "}
            <Link href="/account" className="underline hover:text-stone-600 transition-colors">
              Update your preferences
            </Link>
          </p>
        </>
      )}

      {state === "invalid" && (
        <>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mx-auto">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-stone-900">Invalid link</h1>
          <p className="text-sm text-stone-500">
            This unsubscribe link is invalid or has been tampered with.
            If you&apos;d like to unsubscribe, log in and update your email preferences.
          </p>
          <Link href="/login" className="inline-block text-sm font-medium underline hover:opacity-75 transition-opacity" style={{ color: "#1B4965" }}>
            Go to login
          </Link>
        </>
      )}

      {state === "error" && (
        <>
          <h1 className="text-lg font-bold text-stone-900">Something went wrong</h1>
          <p className="text-sm text-stone-500">
            We couldn&apos;t process your request. Please try again or contact{" "}
            <a href="mailto:hello@myinteriordesigner.co.uk" className="underline">
              hello@myinteriordesigner.co.uk
            </a>
          </p>
        </>
      )}
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #1B4965 0%, #2A5F7F 100%)" }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/MIDLogoGold_Transparent.png" alt="My Interior Designer" className="h-10 mx-auto object-contain" />
        <Suspense fallback={
          <>
            <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-stone-600 animate-spin mx-auto" />
            <p className="text-sm text-stone-500">Updating your preferences…</p>
          </>
        }>
          <UnsubscribeContent />
        </Suspense>
      </div>
    </div>
  );
}
