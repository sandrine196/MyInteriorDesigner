"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth, clearToken, usage as usageApi, type User, type Usage } from "@/lib/api";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [usageData, setUsageData] = useState<Usage | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    auth.me()
      .then((u) => {
        setUser(u);
        return usageApi.get();
      })
      .then(setUsageData)
      .catch(() => router.replace("/login"))
      .finally(() => setReady(true));
  }, [router]);

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-mid-blue animate-spin" />
          <p className="text-sm text-stone-400">Loading your space…</p>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/projects", label: "My Rooms" },
    { href: "/products", label: "Browse Furniture" },
  ];

  const isAccount = pathname.startsWith("/account");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 flex items-stretch justify-between">
        <div className="flex items-center gap-8">
          <Link href="/projects" className="flex items-center py-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MIDLogo.png" alt="My Interior Designer" className="h-8 object-contain" />
          </Link>
          <nav className="flex items-stretch gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  pathname.startsWith(l.href)
                    ? "border-mid-blue text-mid-blue"
                    : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {usageData && user?.tier === "free" && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-mid-gold rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usageData.usedThisMonth / usageData.freeLimit) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-stone-400 whitespace-nowrap">
                {usageData.usedThisMonth}/{usageData.freeLimit} renders
              </span>
            </div>
          )}
          {user && (
            <Link
              href="/account"
              className={`hidden md:block text-xs transition-colors ${
                isAccount ? "text-mid-blue font-medium" : "text-stone-400 hover:text-stone-700"
              }`}
            >
              {user.email}
            </Link>
          )}
          <button
            onClick={signOut}
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {usageData && user?.tier === "free" && usageData.usedThisMonth >= usageData.freeLimit && (
        <div
          className="border-b px-6 py-3 text-sm flex items-center justify-center gap-2"
          style={{ background: "#fff8f0", borderColor: "#f0ddc4", color: "#1B4965" }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>You've used all {usageData.freeLimit} free renders this month.</span>
          <span className="font-semibold ml-1" style={{ color: "#C4935F" }}>Upgrade to Pro for unlimited renders →</span>
        </div>
      )}

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  );
}
