"use client";
import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { admin, type ClientMetrics } from "@/lib/api";

type Range = "7d" | "30d" | "month" | "all";

const RANGES: { label: string; value: Range }[] = [
  { label: "Last 7 days",  value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month",   value: "month" },
  { label: "All time",     value: "all" },
];

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

function Empty({ text }: { text: string }) {
  return <p className="text-stone-600 text-sm py-6 text-center">{text}</p>;
}

export default function ClientsPage() {
  const [data,      setData]      = useState<ClientMetrics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [range,     setRange]     = useState<Range>("30d");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await admin.clientMetrics(range);
      setData(d);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-10 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-stone-500 text-sm mt-1">Users, engagement, funnel, and limit monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && !loading && (
            <span className="text-xs text-stone-600">
              Updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 transition-colors disabled:opacity-40"
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* ── Date range filter ───────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className="text-xs px-4 py-2 rounded-lg font-medium transition-all"
            style={range === r.value
              ? { background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }
              : { background: "transparent", color: "#78716c", border: "1px solid #1e3d54" }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-400 bg-red-950 border border-red-900 rounded-2xl p-4 text-sm">
          Unable to load data. Please refresh. ({error})
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
        </div>
      )}

      {data && (() => {
        const { metrics, funnel, limitMonitor, limitTable, top10, registrationTrend } = data;
        const funnelMax = funnel[0]?.count ?? 1;

        return (
          <>
            {/* ── Key metrics ──────────────────────────────────────────── */}
            <div>
              <SectionHeader title="Key metrics" />
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Total users"        value={metrics.totalUsers} />
                <StatCard label="New this month"     value={metrics.newUsersThisMonth} />
                <StatCard label="Active this month"  value={metrics.activeThisMonth} sub="generated ≥ 1 render" />
                <StatCard label="Total renders"      value={metrics.totalRenders.toLocaleString()} />
                <StatCard label="Avg renders / user" value={metrics.avgRendersPerUser} />
                <StatCard label="Re-engaged"         value={metrics.reEngaged} sub="registered >7d, rendered this week" />
              </div>
            </div>

            {/* ── Engagement rates ─────────────────────────────────────── */}
            <div>
              <SectionHeader title="Engagement" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="rounded-2xl p-5 border" style={{ background: "#1a3044", borderColor: "#243d52" }}>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Return rate — 7 days</p>
                  <p className="text-3xl font-bold text-white">{metrics.returnRate7d}%</p>
                  <p className="text-xs text-stone-500 mt-1">of all users rendered in last 7d</p>
                </div>
                <div className="rounded-2xl p-5 border" style={{ background: "#1a3044", borderColor: "#243d52" }}>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Return rate — 30 days</p>
                  <p className="text-3xl font-bold text-white">{metrics.returnRate30d}%</p>
                  <p className="text-xs text-stone-500 mt-1">of all users rendered in last 30d</p>
                </div>
                <div className="col-span-2 md:col-span-1 rounded-2xl p-5 border"
                  style={{ background: "rgba(212,165,116,0.08)", borderColor: "rgba(212,165,116,0.2)" }}>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Product click-through</p>
                  <p className="text-3xl font-bold" style={{ color: "#D4A574" }}>{metrics.clickThroughRate}%</p>
                  <p className="text-xs text-stone-500 mt-1">of renderers who clicked a product</p>
                </div>
              </div>
            </div>

            {/* ── Conversion funnel ────────────────────────────────────── */}
            <div>
              <SectionHeader title="Conversion funnel" />
              {metrics.totalUsers === 0 ? (
                <div className="rounded-2xl p-6 text-center text-stone-600 text-sm" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
                  No users yet — funnel will appear once users register
                </div>
              ) : (
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
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${pct}%`,
                            background: i === 0 ? "#1B4965" : i === 1 ? "#2A5F7F" : i === 2 ? "#D4A574" : "#C4935F",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Render limit monitor ─────────────────────────────────── */}
            <div>
              <SectionHeader title={`Render limit monitor (free limit: ${limitMonitor.freeLimit} / month)`} />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
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
                <div className="col-span-2 md:col-span-1 rounded-2xl p-5 border"
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

              {/* Limit table */}
              <div className="rounded-2xl overflow-hidden border border-stone-800">
                <div className="px-4 py-3 border-b border-stone-800 text-xs font-medium text-stone-400 uppercase tracking-wider"
                  style={{ background: "#1a3044" }}>
                  Users at ≥50% of monthly limit (this month)
                </div>
                {limitTable.length === 0 ? (
                  <Empty text="No users have reached 50% of their limit yet" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-stone-500 border-b border-stone-800" style={{ background: "#1a3044" }}>
                        <th className="text-left px-4 py-2.5 font-medium">User</th>
                        <th className="text-left px-4 py-2.5 font-medium">Tier</th>
                        <th className="text-right px-4 py-2.5 font-medium">Renders</th>
                        <th className="text-right px-4 py-2.5 font-medium">Limit</th>
                        <th className="text-right px-4 py-2.5 font-medium">Usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {limitTable.map((u, i) => (
                        <tr key={i} className="border-b border-stone-800/50 hover:bg-stone-800/20">
                          <td className="px-4 py-2.5 font-mono text-xs text-stone-300">{u.email}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-medium ${u.tier === "pro" ? "text-amber-400" : "text-stone-500"}`}>
                              {u.tier}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-white font-semibold">{u.renders}</td>
                          <td className="px-4 py-2.5 text-right text-stone-500">{u.limit}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-sm font-bold ${u.usagePct >= 100 ? "text-red-400" : u.usagePct >= 80 ? "text-amber-400" : "text-stone-300"}`}>
                              {u.usagePct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── Registration trend + top users ───────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-5">

              {/* Registration trend */}
              <div>
                <SectionHeader title="Registration trend" />
                <div className="rounded-2xl p-5" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
                  {registrationTrend.every(d => d.count === 0) ? (
                    <Empty text="No signups in this period" />
                  ) : (
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
                  )}
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
                      {top10.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-600">No users yet</td></tr>
                      ) : top10.map(u => (
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
          </>
        );
      })()}
    </div>
  );
}
