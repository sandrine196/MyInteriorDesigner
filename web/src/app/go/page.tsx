"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveToken, saveAgentToken } from "@/lib/api";

export default function GoPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const as    = searchParams.get("as");

    if (!token || !as) {
      setError("Invalid link — missing token or account type.");
      return;
    }

    if (as === "agent") {
      saveAgentToken(token);
      router.replace("/agent-dashboard");
    } else if (as === "user") {
      saveToken(token);
      router.replace("/projects");
    } else {
      setError(`Unknown account type: ${as}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F6F3" }}>
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{error}</p>
          <a href="/admin/impersonate" className="text-sm text-stone-500 hover:text-stone-800 underline">
            Back to impersonation panel
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F6F3" }}>
      <div className="w-6 h-6 rounded-full border-2 border-stone-300 border-t-stone-700 animate-spin" />
    </div>
  );
}
