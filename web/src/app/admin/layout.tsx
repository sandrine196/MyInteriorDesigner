"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, clearToken } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    auth.me()
      .then((user) => {
        if (!user.isAdmin) {
          router.replace("/projects");
          return;
        }
        setEmail(user.email);
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <div className="w-6 h-6 rounded-full border-2 border-stone-700 border-t-sage-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sage-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-white">
                <rect x="1" y="5" width="5" height="8" rx="1" fill="currentColor" fillOpacity="0.85" />
                <rect x="8" y="2" width="5" height="11" rx="1" fill="currentColor" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm tracking-tight">Admin Dashboard</span>
          </Link>
          <span className="text-stone-600 text-xs">My Interior Designer</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-stone-400">
          <span>{email}</span>
          <Link href="/projects" className="hover:text-white transition-colors">← App</Link>
          <button onClick={signOut} className="hover:text-white transition-colors">Sign out</button>
        </div>
      </header>
      <main className="p-6 max-w-screen-2xl mx-auto">{children}</main>
    </div>
  );
}
