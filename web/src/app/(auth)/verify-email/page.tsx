"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/api";

export default function VerifyEmailPage() {
  const params  = useSearchParams();
  const router  = useRouter();
  const token   = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    auth.verifyEmail(token)
      .then(() => {
        setStatus("success");
        setTimeout(() => router.replace("/projects"), 3000);
      })
      .catch(() => setStatus("error"));
  }, [token, router]);

  return (
    <div className="text-center space-y-4">
      {status === "loading" && (
        <>
          <div className="w-8 h-8 rounded-full border-2 border-[#D4A574] border-t-transparent animate-spin mx-auto" />
          <p className="text-stone-500 text-sm">Verifying your email…</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="text-4xl">✓</div>
          <h2 className="text-xl font-bold text-[#062C3D]">Email verified!</h2>
          <p className="text-stone-500 text-sm">Taking you to your projects…</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-4xl">✕</div>
          <h2 className="text-xl font-bold text-[#062C3D]">Link expired or invalid</h2>
          <p className="text-stone-500 text-sm">Verification links expire after 24 hours.</p>
          <Link
            href="/projects"
            className="inline-block mt-2 text-sm text-[#D4A574] hover:underline"
          >
            Go to your projects to request a new link
          </Link>
        </>
      )}
    </div>
  );
}
