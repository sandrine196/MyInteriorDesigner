"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { admin, type AdminMetrics } from "@/lib/api";

// ── Label maps ────────────────────────────────────────────────────────────────

const STYLE_LABELS: Record<string, string> = {
  scandi: "Scandi Minimalist", industrial: "Modern Industrial",
  traditional: "Cosy Traditional", midcentury: "Mid-Century Modern",
  bohemian: "Bohemian", contemporary_luxe: "Contemporary Luxe",
  japandi: "Japandi", coastal: "Coastal",
};
const RETAILER_LABELS: Record<string, string> = {
  john_lewis: "John Lewis", wayfair: "Wayfair", habitat: "Habitat",
  made: "Made.com", dunelm: "Dunelm", amazon: "Amazon",
};

const CHART_COLORS = ["#1B4965", "#2A5F7F", "#D4A574", "#C4935F", "#4A8FA8", "#E5C9A8", "#163d54", "#6BAFC7"];

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtGbp(n: number) { return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function fmtShortDate(iso: string) { return iso.slice(5); } // MM-DD for chart axis

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={accent
        ? { background: "rgba(27,73,101,0.4)", borderColor: "#2A5F7F" }
        : { background: "#1a3044", borderColor: "#243d52" }
      }
    >
      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold tracking-tight" style={{ color: accent ? "#D4A574" : "#ffffff" }}>{value}</p>
      {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-4">{title}</h2>;
}

// ── Chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
      <p className="text-sm font-medium mb-4" style={{ color: "#AECFDB" }}>{title}</p>
      {children}
    </div>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={tier === "pro"
        ? { background: "rgba(212,165,116,0.15)", color: "#D4A574" }
        : { background: "#243d52", color: "#7a9db5" }
      }
    >
      {tier}
    </span>
  );
}

// ── Export button ─────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function ExportButton({ label, path, filename }: { label: string; path: string; filename: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const t = typeof window !== "undefined" ? localStorage.getItem("rv_token") : null;
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent — user will see nothing downloaded
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 hover:text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {busy ? "Exporting…" : label}
    </button>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.metrics()
      .then(setMetrics)
      .catch((err) => setError(err.message ?? "Failed to load metrics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-red-400 bg-red-950 border border-red-900 rounded-2xl p-6 text-sm">
        {error || "Failed to load metrics"}
      </div>
    );
  }

  const m = metrics;

  return (
    <div className="space-y-10">

      {/* ── Page title + exports ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-stone-500 text-sm mt-1">Live data · refreshes on page load</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <ExportButton label="Export Users CSV" path="/admin/export/users" filename="users.csv" />
          <ExportButton label="Export Renders CSV" path="/admin/export/renders" filename="renders.csv" />
        </div>
      </div>

      {/* ── Row 1: Key metrics ────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Key metrics" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={m.users.total}
            sub={`${m.users.free} free · ${m.users.pro} pro`}
          />
          <StatCard label="New Signups (7d)" value={m.newSignups7d} />
          <StatCard label="Total Renders" value={m.totalRenders.toLocaleString()} />
          <StatCard label="Active Users (7d)" value={m.activeUsers7d} sub="users with a render" />
        </div>
      </div>

      {/* ── Row 2: Financial ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Financial" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="MRR" value={fmtGbp(m.mrr)} sub={`${m.users.pro} pro × £9.99`} accent />
          <StatCard label="Gemini API costs" value={fmtGbp(m.estimatedGeminiCosts)} sub="@ £0.03 / render" />
          <StatCard label="Revenue per user" value={fmtGbp(m.revenuePerUser)} />
          <StatCard label="Cost per render" value={fmtGbp(m.costPerRender)} />
        </div>
      </div>

      {/* ── Row 3: Time-series charts ─────────────────────────────────────── */}
      <div>
        <SectionHeader title="Growth (last 30 days)" />
        <div className="grid md:grid-cols-2 gap-5">
          <ChartCard title="Signups per day">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={m.signupsPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: "#78716c", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#78716c", fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={{ background: "#1c1917", border: "1px solid #292524", borderRadius: 8 }}
                  labelStyle={{ color: "#d6d3d1" }}
                  labelFormatter={(v) => fmtDate(String(v))}
                />
                <Line type="monotone" dataKey="count" stroke="#428872" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Renders per day">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={m.rendersPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#292524" />
                <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fill: "#78716c", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#78716c", fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={{ background: "#1c1917", border: "1px solid #292524", borderRadius: 8 }}
                  labelStyle={{ color: "#d6d3d1" }}
                  labelFormatter={(v) => fmtDate(String(v))}
                />
                <Line type="monotone" dataKey="count" stroke="#63a38e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Row 4: Distribution charts ────────────────────────────────────── */}
      <div>
        <SectionHeader title="Usage distribution" />
        <div className="grid md:grid-cols-3 gap-5">

          {/* Design style pie */}
          <ChartCard title="Design styles">
            {m.designStyleDistribution.length === 0 ? (
              <p className="text-stone-600 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={m.designStyleDistribution.map((d) => ({
                      name: STYLE_LABELS[d.style] ?? d.style,
                      value: d.count,
                    }))}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" paddingAngle={2}
                  >
                    {m.designStyleDistribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1c1917", border: "1px solid #292524", borderRadius: 8 }}
                    itemStyle={{ color: "#d6d3d1" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#78716c" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Retailer bar */}
          <ChartCard title="Preferred retailers">
            {m.retailerDistribution.length === 0 ? (
              <p className="text-stone-600 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={m.retailerDistribution.map((d) => ({
                    name: RETAILER_LABELS[d.retailer] ?? d.retailer,
                    count: d.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 8 }}
                >
                  <XAxis type="number" tick={{ fill: "#78716c", fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#a8a29e", fontSize: 11 }} width={70} />
                  <Tooltip
                    contentStyle={{ background: "#1c1917", border: "1px solid #292524", borderRadius: 8 }}
                    itemStyle={{ color: "#d6d3d1" }}
                  />
                  <Bar dataKey="count" fill="#428872" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Summary stats */}
          <div className="space-y-4">
            <StatCard label="Renders per user (avg)" value={m.rendersPerUser} />
            <StatCard
              label="Average max budget"
              value={m.averageBudget ? `£${m.averageBudget.toLocaleString()}` : "—"}
            />
          </div>
        </div>
      </div>

      {/* ── Row 5: Top users + Recent signups ────────────────────────────── */}
      <div>
        <SectionHeader title="Users" />
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Top 10 users by render count */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-800">
              <p className="text-sm font-medium text-stone-300">Top users by render count</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 border-b border-stone-800">
                  <th className="text-left px-5 py-2 font-medium">User</th>
                  <th className="text-left py-2 font-medium">Tier</th>
                  <th className="text-right px-5 py-2 font-medium">Renders</th>
                </tr>
              </thead>
              <tbody>
                {m.topUsers.map((u, i) => (
                  <tr key={u.id} className="border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-2.5 text-stone-300">
                      <span className="text-stone-600 mr-2 text-xs">{i + 1}.</span>
                      {u.email}
                    </td>
                    <td className="py-2.5"><TierBadge tier={u.tier} /></td>
                    <td className="px-5 py-2.5 text-right text-white font-semibold">{u.renderCount}</td>
                  </tr>
                ))}
                {m.topUsers.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-stone-600">No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recent signups */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-800">
              <p className="text-sm font-medium text-stone-300">Recent signups</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 border-b border-stone-800">
                  <th className="text-left px-5 py-2 font-medium">Email</th>
                  <th className="text-left py-2 font-medium">Tier</th>
                  <th className="text-right px-5 py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {m.recentSignups.map((u) => (
                  <tr key={u.id} className="border-b border-stone-800/50 hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-2.5 text-stone-300">{u.email}</td>
                    <td className="py-2.5"><TierBadge tier={u.tier} /></td>
                    <td className="px-5 py-2.5 text-right text-stone-500">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
                {m.recentSignups.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-stone-600">No signups yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Row 6: Recent renders ─────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Recent renders" />
        {m.recentRenders.length === 0 ? (
          <p className="text-stone-600 text-sm">No renders yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {m.recentRenders.map((r) => (
              <div key={r.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                <div className="relative h-32 bg-stone-800">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="Render" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <svg className="w-8 h-8 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                      </svg>
                    </div>
                  )}
                  <span className={`absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded font-medium ${
                    r.status === "done" ? "bg-mid-blue text-mid-gold-light" :
                    r.status === "failed" ? "bg-red-900 text-red-300" : "bg-stone-700 text-stone-400"
                  }`}>
                    {r.status}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs text-stone-400 truncate">{r.userEmail}</p>
                  <p className="text-xs text-stone-600">{fmtDate(r.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
