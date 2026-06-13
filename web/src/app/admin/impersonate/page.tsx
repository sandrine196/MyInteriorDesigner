"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";

type User = { id: string; email: string; tier: string; isAdmin: boolean; createdAt: string };
type Agent = { id: string; name: string; agencyName: string; email: string; status: string; referralCode: string };

function openAs(token: string, as: "user" | "agent") {
  const url = `/go?token=${encodeURIComponent(token)}&as=${as}`;
  window.open(url, "_blank", "noopener");
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free:    "bg-stone-100 text-stone-500",
    pro:     "bg-amber-50 text-amber-700",
    premium: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${colors[tier] ?? "bg-stone-100 text-stone-500"}`}>
      {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:    "bg-emerald-50 text-emerald-700",
    pending:   "bg-amber-50 text-amber-700",
    suspended: "bg-red-50 text-red-600",
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${colors[status] ?? "bg-stone-100 text-stone-500"}`}>
      {status}
    </span>
  );
}

export default function ImpersonatePage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [agents,      setAgents]      = useState<Agent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingId,   setLoadingId]   = useState<string | null>(null);
  const [error,       setError]       = useState("");
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    admin.impersonate.list()
      .then(({ users: u, agents: a }) => { setUsers(u); setAgents(a); })
      .catch(() => setError("Failed to load accounts"))
      .finally(() => setLoading(false));
  }, []);

  async function handleUser(user: User) {
    setLoadingId(user.id);
    try {
      const { token } = await admin.impersonate.asUser(user.id);
      openAs(token, "user");
    } catch {
      setError(`Could not impersonate ${user.email}`);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleAgent(agent: Agent) {
    setLoadingId(agent.id);
    try {
      const { token } = await admin.impersonate.asAgent(agent.id);
      openAs(token, "agent");
    } catch {
      setError(`Could not impersonate ${agent.email}`);
    } finally {
      setLoadingId(null);
    }
  }

  const q = search.toLowerCase();
  const filteredUsers  = users.filter(u =>
    u.email.toLowerCase().includes(q) || u.tier.includes(q)
  );
  const filteredAgents = agents.filter(a =>
    a.email.toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.agencyName.toLowerCase().includes(q)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Test as account</h1>
        <p className="text-sm mt-1" style={{ color: "#AECFDB" }}>
          Opens a new tab logged in as that user or agent. Your admin session is not affected.
          Tokens expire in 2 hours.
        </p>
      </div>

      {/* ── Quick links ───────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 border border-white/10 space-y-3" style={{ background: "#0d2233" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4A574" }}>Estate agent workflow</p>
          <p className="text-xs text-stone-400 leading-relaxed">
            Test the full agent experience: register, receive a magic link, access the dashboard and virtual staging tool.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/agents" target="_blank" rel="noopener"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
              Register as agent →
            </a>
            <a href="/agent-login" target="_blank" rel="noopener"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all text-stone-400 border border-white/10 hover:text-white">
              Agent sign-in →
            </a>
            <a href="/agent-dashboard" target="_blank" rel="noopener"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all text-stone-400 border border-white/10 hover:text-white">
              Agent dashboard →
            </a>
          </div>
        </div>

        <div className="rounded-2xl p-5 border border-white/10 space-y-3" style={{ background: "#0d2233" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4A574" }}>Homeowner workflow</p>
          <p className="text-xs text-stone-400 leading-relaxed">
            Test the homeowner experience: sign in, generate renders, browse products.
            Or pick an account below and click "Test as →" to jump in as that user.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/login" target="_blank" rel="noopener"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
              Sign in as homeowner →
            </a>
            <a href="/projects" target="_blank" rel="noopener"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all text-stone-400 border border-white/10 hover:text-white">
              Projects page →
            </a>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 rounded-xl px-4 py-3 border border-red-800/40">{error}</p>
      )}

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by email, name, agency…"
        className="w-full max-w-sm rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 text-white placeholder:text-stone-500 focus:outline-none focus:border-mid-gold"
      />

      {/* ── Homeowners ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold mb-3 tracking-wide" style={{ color: "#D4A574" }}>
          HOMEOWNERS ({filteredUsers.length})
        </h2>
        <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: "#0d2233" }}>
          {filteredUsers.length === 0 ? (
            <p className="text-sm text-stone-500 px-5 py-6">No homeowners found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-stone-500 border-b border-white/10">
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-3 py-3 font-medium">Tier</th>
                  <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">Joined</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-stone-200 truncate max-w-xs">
                      {u.email}
                      {u.isAdmin && (
                        <span className="ml-2 text-[10px] font-semibold text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">admin</span>
                      )}
                    </td>
                    <td className="px-3 py-3"><TierBadge tier={u.tier} /></td>
                    <td className="px-3 py-3 text-stone-500 text-xs hidden sm:table-cell">
                      {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => handleUser(u)}
                        disabled={loadingId === u.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}
                      >
                        {loadingId === u.id ? "Opening…" : "Test as →"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Estate agents ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold mb-3 tracking-wide" style={{ color: "#D4A574" }}>
          ESTATE AGENTS ({filteredAgents.length})
        </h2>
        <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: "#0d2233" }}>
          {filteredAgents.length === 0 ? (
            <p className="text-sm text-stone-500 px-5 py-6">No agents found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-stone-500 border-b border-white/10">
                  <th className="text-left px-5 py-3 font-medium">Name / Agency</th>
                  <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">Email</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredAgents.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="text-stone-200 font-medium">{a.name}</p>
                      <p className="text-xs text-stone-500">{a.agencyName}</p>
                    </td>
                    <td className="px-3 py-3 text-stone-400 text-xs hidden sm:table-cell truncate max-w-xs">{a.email}</td>
                    <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => handleAgent(a)}
                        disabled={loadingId === a.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                        style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}
                      >
                        {loadingId === a.id ? "Opening…" : "Test as →"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
