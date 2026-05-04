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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f2535" }}>
        <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-stone-100" style={{ background: "#0f2535" }}>
      <header className="px-6 h-14 flex items-center justify-between" style={{ background: "#1B4965", borderBottom: "1px solid #2A5F7F" }}>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MIDLogoPrussianBlue_Gold.png" alt="My Interior Designer" className="h-7 object-contain" />
            <span className="font-semibold text-white text-sm tracking-tight">Admin Dashboard</span>
          </Link>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "#AECFDB" }}>
          <span>{email}</span>
          <Link href="/projects" className="hover:text-white transition-colors">← App</Link>
          <button onClick={signOut} className="hover:text-white transition-colors">Sign out</button>
        </div>
      </header>
      <main className="p-6 max-w-screen-2xl mx-auto">{children}</main>
    </div>
  );
}
