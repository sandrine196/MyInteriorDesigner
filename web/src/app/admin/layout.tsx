"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth, clearToken } from "@/lib/api";

const NAV = [
  { href: "/admin",            label: "Overview",   icon: "⊞" },
  { href: "/admin/financial",  label: "Financial",  icon: "£" },
  { href: "/admin/marketing",  label: "Marketing",  icon: "↗" },
  { href: "/admin/clients",    label: "Clients",    icon: "👤" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady]   = useState(false);
  const [email, setEmail]   = useState("");
  const [open,  setOpen]    = useState(false);

  useEffect(() => {
    auth.me()
      .then((user) => {
        if (!user.isAdmin) { router.replace("/projects"); return; }
        setEmail(user.email);
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f2535" }}>
        <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0f2535" }}>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="h-14 flex items-center justify-between px-4 md:px-6 shrink-0"
        style={{ background: "#1B4965", borderBottom: "1px solid #2A5F7F" }}>
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1 rounded text-stone-300 hover:text-white"
            onClick={() => setOpen(v => !v)}
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/admin" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/MIDLogoPrussianBlue_Gold.png" alt="My Interior Designer" className="h-7 object-contain" />
            <span className="font-semibold text-white text-sm tracking-tight hidden sm:block">Admin</span>
          </Link>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "#AECFDB" }}>
          <span className="hidden sm:block truncate max-w-40">{email}</span>
          <Link href="/projects" className="hover:text-white transition-colors whitespace-nowrap">← App</Link>
          <button onClick={() => { clearToken(); router.replace("/login"); }}
            className="hover:text-white transition-colors">Sign out</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside
          className={`
            ${open ? "translate-x-0" : "-translate-x-full"}
            md:translate-x-0
            fixed md:static inset-y-14 left-0 z-40
            w-52 shrink-0 flex flex-col
            transition-transform duration-200 md:transition-none
          `}
          style={{ background: "#122c3f", borderRight: "1px solid #1e3d54" }}
        >
          <nav className="p-3 flex-1">
            {NAV.map(({ href, label, icon }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all
                    ${active
                      ? "text-white"
                      : "text-stone-400 hover:text-stone-200 hover:bg-white/5"}
                  `}
                  style={active ? { background: "rgba(212,165,116,0.15)", color: "#D4A574" } : {}}
                >
                  <span className="text-base w-5 text-center">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t text-xs text-stone-600" style={{ borderColor: "#1e3d54" }}>
            MyInteriorDesigner.co.uk
          </div>
        </aside>

        {/* Overlay for mobile */}
        {open && (
          <div
            className="fixed inset-0 z-30 md:hidden"
            style={{ background: "rgba(0,0,0,0.5)", top: 56 }}
            onClick={() => setOpen(false)}
          />
        )}

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 text-stone-100">
          {children}
        </main>
      </div>
    </div>
  );
}
