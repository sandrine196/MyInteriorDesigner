"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";

type ProjectSummary = {
  name: string;
  roomType: string | null;
  renderCount: number;
  latestRenderUrl: string | null;
};

type GeoInfo = { country: string; countryCode: string; city: string } | null;

type AdminUser = {
  id: string; email: string; tier: string;
  suspended: boolean; emailVerified: boolean;
  createdAt: string; lastLoginAt: string | null;
  lastLoginIp: string | null; location: GeoInfo;
  projectCount: number;
  projects: ProjectSummary[];
};

type Filter = "all" | "unverified" | "suspended" | "no-project";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All",          value: "all" },
  { label: "Unverified",   value: "unverified" },
  { label: "No project",   value: "no-project" },
  { label: "Suspended",    value: "suspended" },
];

function daysAgo(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [filter,  setFilter]  = useState<Filter>("all");
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    admin.users.list()
      .then(setUsers)
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleSuspend(u: AdminUser) {
    const next = !u.suspended;
    if (!confirm(`${next ? "Suspend" : "Unsuspend"} ${u.email}?`)) return;
    try {
      await admin.users.setSuspended(u.id, next);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, suspended: next } : x));
    } catch {
      alert("Failed to update user");
    }
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    try {
      await admin.users.delete(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
    } catch {
      alert("Failed to delete user");
    }
  }

  const visible = users
    .filter(u => {
      if (search) return u.email.toLowerCase().includes(search.toLowerCase());
      if (filter === "unverified") return !u.emailVerified;
      if (filter === "suspended")  return u.suspended;
      if (filter === "no-project") return u.projectCount === 0;
      return true;
    });

  const counts = {
    all:         users.length,
    unverified:  users.filter(u => !u.emailVerified).length,
    "no-project": users.filter(u => u.projectCount === 0).length,
    suspended:   users.filter(u => u.suspended).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
        <p className="text-stone-400 text-sm mt-1">{users.length} total accounts</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setSearch(""); }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={filter === f.value && !search
                ? { background: "rgba(212,165,116,0.2)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.4)" }
                : { background: "#1a3044", color: "#6b7a88", border: "1px solid #1e3d54" }
              }
            >
              {f.label} <span className="opacity-60 ml-1">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setFilter("all"); }}
          className="flex-1 min-w-48 text-sm rounded-lg px-3 py-1.5 text-white placeholder-stone-600 focus:outline-none"
          style={{ background: "#1a3044", border: "1px solid #1e3d54" }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center h-32 items-center">
          <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-stone-800">
          <table className="w-full text-sm">
            <thead style={{ background: "#1a3044" }}>
              <tr className="text-xs text-stone-500 border-b border-stone-800">
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-center px-4 py-3 font-medium">Tier</th>
                <th className="text-center px-4 py-3 font-medium">Verified</th>
                <th className="text-center px-4 py-3 font-medium">Projects</th>
                <th className="text-right px-4 py-3 font-medium">Joined</th>
                <th className="text-right px-4 py-3 font-medium">Last login</th>
                <th className="text-right px-4 py-3 font-medium">Location</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-600">No users match</td></tr>
              ) : visible.map(u => {
                const joinedDays   = daysAgo(u.createdAt);
                const loginDays    = daysAgo(u.lastLoginAt);
                return (
                  <tr key={u.id}
                    className="border-b border-stone-800/50 hover:bg-stone-800/20"
                    style={u.suspended ? { opacity: 0.5 } : {}}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-stone-200">{u.email}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className={u.tier === "pro" ? "text-amber-400 font-semibold" : "text-stone-500"}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {u.emailVerified
                        ? <span className="text-emerald-400">✓</span>
                        : <span className="text-amber-500">⏳</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-400">
                      {u.projects.length === 0
                        ? <span className="text-stone-600">—</span>
                        : <div className="space-y-2">
                            {u.projects.map((p, i) => (
                              <div key={i} className="flex items-center gap-2">
                                {p.latestRenderUrl
                                  ? <a href={p.latestRenderUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                      <img
                                        src={p.latestRenderUrl}
                                        alt=""
                                        className="w-12 h-9 object-cover rounded hover:opacity-80 transition-opacity"
                                        style={{ border: "1px solid #1e3d54" }}
                                      />
                                    </a>
                                  : <div className="w-12 h-9 rounded flex-shrink-0 flex items-center justify-center text-stone-700"
                                      style={{ background: "#1a3044", border: "1px solid #1e3d54" }}>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                }
                                <div>
                                  <div className="text-stone-300">{p.roomType ?? p.name}</div>
                                  <div className="text-stone-600">
                                    {p.renderCount === 0 ? "no renders" : `${p.renderCount} render${p.renderCount > 1 ? "s" : ""}`}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-stone-500">
                      {joinedDays === 0 ? "Today" : joinedDays === 1 ? "Yesterday" : `${joinedDays}d ago`}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {loginDays == null
                        ? <span className="text-stone-600">—</span>
                        : <span className={loginDays === 0 ? "text-emerald-400" : "text-stone-500"}>
                            {loginDays === 0 ? "Today" : `${loginDays}d ago`}
                          </span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {u.location
                        ? <span className="text-stone-300">{u.location.city}, {u.location.countryCode}</span>
                        : <span className="text-stone-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleSuspend(u)}
                          className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                          style={u.suspended
                            ? { background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
                            : { background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
                          }
                        >
                          {u.suspended ? "Unsuspend" : "Suspend"}
                        </button>
                        {u.suspended && (
                          <button
                            onClick={() => deleteUser(u)}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
