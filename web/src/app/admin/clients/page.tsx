"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { admin, type ClientMetrics } from "@/lib/api";

function fmtDate(iso: string) { return iso.slice(5); }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: "#1a3044", borderColor: "#243d52" }}>
      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-4">{title}</h2>;
}

export default function ClientsPage() {
  const [data,    setData]    = useState<ClientMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    admin.clientMetrics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
    </div>
  );
  if (error || !data) return (
    <div className="text-red-400 bg-red-950 border border-red-900 rounded-2xl p-6 text-sm">{error || "Failed"}</div>
  );

  const { metrics, funnel, limitMonitor, top10, registrationTrend } = data;
  const funnelMax = funnel[0]?.count ?? 1;

  return (
    <div className="space-y-10 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <p className="text-stone-500 text-sm mt-1">Users, engagement, funnel, and limit monitoring</p>
      </div>

      {/* ── Key metrics ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Key metrics" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total users"       value={metrics.totalUsers} />
          <StatCard label="New this month"    value={metrics.newUsersThisMonth} />
          <StatCard label="Active this month" value={metrics.activeThisMonth} sub="generated ≥ 1 render" />
          <StatCard label="Total renders"     value={metrics.totalRenders.toLocaleString()} />
          <StatCard label="Avg renders / user" value={metrics.avgRendersPerUser} />
          <StatCard label="Re-engaged users"  value={metrics.reEngaged} sub="registered >7d, rendered this week" />
        </div>
      </div>

      {/* ── Funnel ─────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Conversion funnel" />
        <div className="rounded-2xl p-6 space-y-3" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
          {funnel.map((step, i) => {
            const pct    = funnelMax > 0 ? Math.round(step.count / funnelMax * 100) : 0;
            const dropPct = i > 0 && funnel[i - 1].count > 0
              ? Math.round((1 - step.count / funnel[i - 1].count) * 100)
              : null;
            return (
              <div key={step.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-stone-300 font-medium">{step.stage}</span>
                  <div className="flex items-center gap-3">
                    {dropPct !== null && dropPct > 0 && (
                      <span className="text-xs text-red-400">−{dropPct}% drop</span>
                    )}
                    <span className="text-sm text-white font-bold tabular-nums">{step.count.toLocaleString()}</span>
                    <span className="text-xs text-stone-500 w-10 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: i === 0 ? "#1B4965" : i === 1 ? "#2A5F7F" : i === 2 ? "#D4A574" : "#C4935F",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Render limit monitor ────────────────────────────────────────── */}
      <div>
        <SectionHeader title={`Render limit monitor (free limit: ${limitMonitor.freeLimit} / month)`} />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 border" style={{ background: "#1a3044", borderColor: "#243d52" }}>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Near limit (80%+)</p>
            <p className="text-3xl font-bold text-amber-400">{limitMonitor.nearLimit}</p>
            <p className="text-xs text-stone-500 mt-1">users approaching cap</p>
          </div>
          <div className="rounded-2xl p-5 border" style={{ background: "#1a3044", borderColor: "#243d52" }}>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Hit limit</p>
            <p className="text-3xl font-bold text-red-400">{limitMonitor.atLimit}</p>
            <p className="text-xs text-stone-500 mt-1">users blocked — demand for Pro</p>
          </div>
          <div className="rounded-2xl p-5 border col-span-2 md:col-span-1"
            style={{ background: "rgba(212,165,116,0.08)", borderColor: "rgba(212,165,116,0.2)" }}>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Upgrade signal</p>
            <p className="text-3xl font-bold" style={{ color: "#D4A574" }}>
              {limitMonitor.atLimit > 0
                ? `${Math.round(limitMonitor.atLimit / (metrics.totalUsers || 1) * 100)}%`
                : "—"}
            </p>
            <p className="text-xs text-stone-500 mt-1">of users blocked this month</p>
          </div>
        </div>
      </div>

      {/* ── Registration trend + top users ─────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Registration trend */}
        <div>
          <SectionHeader title="Registration trend — last 30 days" />
          <div className="rounded-2xl p-5" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3d54" />
                <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "#78716c", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#78716c", fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={{ background: "#0f2535", border: "1px solid #243d52", borderRadius: 8 }}
                  labelStyle={{ color: "#d6d3d1" }}
                />
                <Line type="monotone" dataKey="count" stroke="#2A5F7F" strokeWidth={2} dot={false} name="Signups" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 10 users */}
        <div>
          <SectionHeader title="Most active users (anonymised)" />
          <div className="rounded-2xl overflow-hidden border border-stone-800">
            <table className="w-full text-sm">
              <thead style={{ background: "#1a3044" }}>
                <tr className="text-xs text-stone-500 border-b border-stone-800">
                  <th className="text-left px-4 py-2.5 font-medium">#</th>
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-right px-4 py-2.5 font-medium">Renders</th>
                  <th className="text-right px-4 py-2.5 font-medium">Member for</th>
                </tr>
              </thead>
              <tbody>
                {top10.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-600">No users yet</td></tr>
                )}
                {top10.map(u => (
                  <tr key={u.rank} className="border-b border-stone-800/50 hover:bg-stone-800/20">
                    <td className="px-4 py-2.5 text-stone-600 text-xs">{u.rank}</td>
                    <td className="px-4 py-2.5 text-stone-300 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2.5 text-right text-white font-semibold">{u.renderCount}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                      {u.joinedDaysAgo === 0 ? "Today" : `${u.joinedDaysAgo}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
