"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { admin, type CostEntry, type RevenueEntry, type LiveCosts, type LiveCostDataSource } from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function gbp(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function usd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SourceBadge({ source }: { source: LiveCostDataSource }) {
  const config = {
    live_api:   { label: "Live",       icon: "✅", cls: "text-green-400 bg-green-950 border-green-800" },
    calculated: { label: "Calculated", icon: "🔢", cls: "text-blue-400 bg-blue-950 border-blue-800" },
    manual:     { label: "Manual",     icon: "✏️", cls: "text-amber-400 bg-amber-950 border-amber-800" },
    error:      { label: "Error",      icon: "⚠️", cls: "text-red-400 bg-red-950 border-red-800" },
  }[source];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${config.cls}`}>
      {config.icon} {config.label}
    </span>
  );
}

function LiveCostPanel({ period }: { period: "month" | "week" | "today" }) {
  const [data,         setData]         = useState<LiveCosts | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [lastFetched,  setLastFetched]  = useState<Date | null>(null);
  const [timeSince,    setTimeSince]    = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await admin.liveCosts(period);
      setData(result);
      setLastFetched(new Date());
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Auto-fetch on mount and when period changes
  useEffect(() => { fetch(); }, [fetch]);

  // Update "X mins ago" label every 30s
  useEffect(() => {
    if (!lastFetched) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - lastFetched.getTime()) / 1000);
      if (secs < 60) setTimeSince(`${secs}s ago`);
      else setTimeSince(`${Math.floor(secs / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [lastFetched]);

  type CostKey = keyof Omit<LiveCosts["costs"], "total">;
  const rows: Array<{ key: CostKey; label: string }> = [
    { key: "gemini",  label: "Gemini (AI renders)" },
    { key: "reve",    label: "Virtual staging (Gemini)" },
    { key: "railway", label: "Railway (backend hosting)" },
    { key: "r2",      label: "Cloudflare R2 (storage)" },
    { key: "resend",  label: "Resend (email)" },
    { key: "vercel",  label: "Vercel (frontend hosting)" },
  ];

  return (
    <div className="rounded-2xl border" style={{ background: "#111d2b", borderColor: "#1e3349" }}>
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e3349" }}>
        <div>
          <p className="text-sm font-semibold text-stone-200">Live Cost Snapshot</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Pulled from provider APIs + calculated from DB · All figures in USD
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && !loading && (
            <span className="text-xs text-stone-600">Updated {timeSince}</span>
          )}
          <button
            onClick={fetch}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 transition-colors disabled:opacity-40"
          >
            {loading ? "Fetching…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
        </div>
      ) : data ? (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-600 border-b" style={{ borderColor: "#1e3349" }}>
                <th className="text-left px-5 py-2.5 font-medium">Provider</th>
                <th className="text-left px-5 py-2.5 font-medium">Data source</th>
                <th className="text-right px-5 py-2.5 font-medium">Cost (USD)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, label }) => (
                <tr key={key} className="border-b" style={{ borderColor: "#1a2d41" }}>
                  <td className="px-5 py-3 text-stone-300">{label}</td>
                  <td className="px-5 py-3">
                    <SourceBadge source={data.dataSource[key]} />
                    {data.errors[key] && (
                      <span className="ml-2 text-xs text-red-500" title={data.errors[key]}>· {data.errors[key].slice(0, 40)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-stone-200">
                    {usd(data.costs[key])}
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#0f1f30" }}>
                <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Total</td>
                <td />
                <td className="px-5 py-3 text-right font-mono font-bold text-white">{usd(data.costs.total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Render breakdown */}
          <div className="px-5 py-3 border-t flex flex-wrap gap-6 text-xs text-stone-500" style={{ borderColor: "#1e3349" }}>
            <span>Renders this {data.period}: <span className="text-stone-300 font-medium">{data.renders.total}</span></span>
            <span>Regular: <span className="text-stone-300 font-medium">{data.renders.regular}</span></span>
            <span>Staging: <span className="text-stone-300 font-medium">{data.renders.staging}</span></span>
            {data.renders.total > 0 && (
              <span>Cost/render: <span className="text-stone-300 font-medium">{usd(data.costs.total / data.renders.total)}</span></span>
            )}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t flex flex-wrap gap-4" style={{ borderColor: "#1e3349" }}>
            {(["live_api", "calculated", "manual", "error"] as LiveCostDataSource[]).map(s => (
              <SourceBadge key={s} source={s} />
            ))}
            <span className="text-xs text-stone-600 self-center">· Vercel costs pulled from your manual CostEntry below</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const REVENUE_SOURCES = ["CJ Affiliate", "Amazon Associates", "Premium Subscriptions", "Estate Agent Partners", "Other"];
const REVENUE_TYPES   = ["Affiliate", "Subscription", "Partnership", "Other"];
const STATUS_OPTIONS  = ["active", "pending", "inactive", "cancelled"];

// ── Editable cell ──────────────────────────────────────────────────────────────

function EditCell({
  value, type = "text", onCommit, className = "",
}: {
  value: string | number;
  type?: "text" | "number";
  onCommit: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className={`cursor-pointer hover:underline decoration-dotted underline-offset-2 ${className}`}
        title="Click to edit"
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onCommit(draft); }}
      onKeyDown={e => {
        if (e.key === "Enter") { setEditing(false); onCommit(draft); }
        if (e.key === "Escape") { setEditing(false); setDraft(String(value)); }
      }}
      className="bg-stone-800 border border-mid-gold rounded px-2 py-0.5 text-sm text-white w-full outline-none"
    />
  );
}

function SelectCell({
  value, options, onCommit, className = "",
}: {
  value: string; options: string[]; onCommit: (v: string) => void; className?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onCommit(e.target.value)}
      className={`bg-transparent border-0 text-sm cursor-pointer outline-none ${className}`}
    >
      {options.map(o => <option key={o} value={o} className="bg-stone-900">{o}</option>)}
    </select>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FinancialPage() {
  const now = new Date();
  const [month,     setMonth]     = useState(now.getMonth() + 1);
  const [year,      setYear]      = useState(now.getFullYear());
  const [costs,     setCosts]     = useState<CostEntry[]>([]);
  const [revenues,  setRevenues]  = useState<RevenueEntry[]>([]);
  const [summary,   setSummary]   = useState<Array<{ label: string; totalCost: number; totalRevenue: number; profit: number }>>([]);
  const [cumProfit, setCumProfit] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, s] = await Promise.all([
        admin.costs.list(month, year),
        admin.revenues.list(month, year),
        admin.financialSummary(),
      ]);
      setCosts(c.entries);
      setRevenues(r.entries);
      setSummary(s.summary);
      setCumProfit(s.cumulativeProfit);
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Cost mutations ──────────────────────────────────────────────────────────

  async function updateCost(id: string, field: keyof CostEntry, raw: string) {
    const value = field === "monthlyCostGbp" ? parseFloat(raw) || 0 : raw;
    setSaving(id);
    try {
      const { entry } = await admin.costs.update(id, { [field]: value });
      setCosts(prev => prev.map(c => c.id === id ? entry : c));
    } finally { setSaving(null); }
  }

  async function deleteCost(id: string) {
    if (!confirm("Remove this cost entry?")) return;
    await admin.costs.remove(id);
    setCosts(prev => prev.filter(c => c.id !== id));
  }

  async function addCost() {
    const entry = await admin.costs.create({
      provider: "New provider", plan: "—", monthlyCostGbp: 0,
      month, year, status: "active", notes: null,
    });
    setCosts(prev => [...prev, entry.entry]);
  }

  // ── Revenue mutations ───────────────────────────────────────────────────────

  async function updateRevenue(id: string, field: keyof RevenueEntry, raw: string) {
    const value = field === "amountGbp" ? parseFloat(raw) || 0 : raw;
    setSaving(id);
    try {
      const { entry } = await admin.revenues.update(id, { [field]: value });
      setRevenues(prev => prev.map(r => r.id === id ? entry : r));
    } finally { setSaving(null); }
  }

  async function deleteRevenue(id: string) {
    if (!confirm("Remove this revenue entry?")) return;
    await admin.revenues.remove(id);
    setRevenues(prev => prev.filter(r => r.id !== id));
  }

  async function addRevenue() {
    const entry = await admin.revenues.create({
      source: "CJ Affiliate", type: "Affiliate", amountGbp: 0,
      month, year, notes: null,
    });
    setRevenues(prev => [...prev, entry.entry]);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalCost    = costs.filter(c => c.status !== "inactive").reduce((s, c) => s + c.monthlyCostGbp, 0);
  const totalRevenue = revenues.reduce((s, r) => s + r.amountGbp, 0);
  const netProfit    = totalRevenue - totalCost;

  const exportCostsCsv = () => {
    const rows = [
      ["Provider", "Plan", "Monthly Cost", "Status", "Notes"],
      ...costs.map(c => [c.provider, c.plan, c.monthlyCostGbp, c.status, c.notes ?? ""]),
      ["TOTAL", "", totalCost, "", ""],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `costs-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
  };

  const exportRevenueCsv = () => {
    const rows = [
      ["Source", "Type", "Amount", "Notes"],
      ...revenues.map(r => [r.source, r.type, r.amountGbp, r.notes ?? ""]),
      ["TOTAL", "", totalRevenue, ""],
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `revenue-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
  };

  // Only chart months that have real data
  const chartData = summary.filter(m => m.totalCost > 0 || m.totalRevenue > 0);

  if (loading && costs.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
    </div>
  );

  return (
    <div className="space-y-10 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Financial</h1>
          <p className="text-stone-500 text-sm mt-1">Costs, revenue, and P&amp;L</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {updatedAt && !loading && (
            <span className="text-xs text-stone-600">
              Updated {updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={loadData} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 transition-colors disabled:opacity-40">
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="bg-stone-800 border border-stone-700 text-stone-200 text-sm rounded-lg px-3 py-2 outline-none"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="bg-stone-800 border border-stone-700 text-stone-200 text-sm rounded-lg px-3 py-2 outline-none"
          >
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── Key metrics ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total costs",    value: gbp(totalCost),    sub: `${costs.length} providers` },
          { label: "Total revenue",  value: gbp(totalRevenue), sub: `${revenues.length} sources` },
          { label: "Net this month", value: gbp(netProfit),
            accent: netProfit >= 0, negative: netProfit < 0 },
          { label: "Cumulative P&L", value: gbp(cumProfit),
            accent: cumProfit >= 0, negative: cumProfit < 0 },
        ].map(({ label, value, sub, accent, negative }) => (
          <div key={label} className="rounded-2xl p-5 border"
            style={{ background: "#1a3044", borderColor: "#243d52" }}>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">{label}</p>
            <p className={`text-2xl font-bold ${negative ? "text-red-400" : accent ? "text-green-400" : "text-white"}`}>
              {value}
            </p>
            {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Live cost snapshot ─────────────────────────────────────────── */}
      <LiveCostPanel period="month" />

      {/* ── P&L chart ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
        <p className="text-sm font-medium text-stone-300 mb-5">Monthly P&amp;L — last 12 months</p>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-center">
            <div>
              <p className="text-stone-500 text-sm">No financial data yet.</p>
              <p className="text-stone-600 text-xs mt-1">Add your first month&apos;s costs and revenue to see your P&amp;L chart.</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3d54" />
              <XAxis dataKey="label" tick={{ fill: "#78716c", fontSize: 11 }} />
              <YAxis tick={{ fill: "#78716c", fontSize: 11 }} width={50}
                tickFormatter={v => `£${v}`} />
              <Tooltip
                contentStyle={{ background: "#0f2535", border: "1px solid #243d52", borderRadius: 8 }}
                labelStyle={{ color: "#d6d3d1" }}
                formatter={(v) => gbp(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#78716c" }} />
              <Bar dataKey="totalCost"    name="Costs"   fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="totalRevenue" name="Revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Line dataKey="profit" name="Profit/Loss" stroke="#D4A574"
                strokeWidth={2} dot={false} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Costs table ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Provider costs — {MONTHS[month - 1]} {year}
          </h2>
          <div className="flex gap-2">
            <button onClick={exportCostsCsv}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 transition-colors">
              Export CSV
            </button>
            <button onClick={addCost}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-colors"
              style={{ background: "#1B4965" }}>
              + Add row
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-stone-800">
          <table className="w-full text-sm">
            <thead style={{ background: "#1a3044" }}>
              <tr className="text-xs text-stone-500 border-b border-stone-800">
                <th className="text-left px-4 py-3 font-medium">Provider</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-right px-4 py-3 font-medium">Monthly cost</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} className="border-b border-stone-800/50 hover:bg-stone-800/20 transition-colors"
                  style={{ opacity: saving === c.id ? 0.5 : c.status === "inactive" ? 0.45 : 1 }}>
                  <td className="px-4 py-3 text-stone-200">
                    <EditCell value={c.provider} onCommit={v => updateCost(c.id, "provider", v)} />
                  </td>
                  <td className="px-4 py-3 text-stone-400">
                    <EditCell value={c.plan} onCommit={v => updateCost(c.id, "plan", v)} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-stone-200">
                    <EditCell value={c.monthlyCostGbp.toFixed(2)} type="number"
                      onCommit={v => updateCost(c.id, "monthlyCostGbp", v)}
                      className="text-right" />
                  </td>
                  <td className="px-4 py-3">
                    <SelectCell value={c.status} options={STATUS_OPTIONS}
                      onCommit={v => updateCost(c.id, "status", v)}
                      className={
                        c.status === "active"   ? "text-green-400"  :
                        c.status === "pending"  ? "text-amber-400"  :
                        c.status === "inactive" ? "text-stone-600"  :
                        "text-stone-500"
                      } />
                  </td>
                  <td className="px-4 py-3 text-stone-500 max-w-xs">
                    <EditCell value={c.notes ?? "—"} onCommit={v => updateCost(c.id, "notes", v)} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteCost(c.id)}
                      className="text-stone-600 hover:text-red-400 transition-colors text-xs">✕</button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#1a3044" }}>
                <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-white">{gbp(totalCost)}</td>
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Revenue table ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Revenue — {MONTHS[month - 1]} {year}
          </h2>
          <div className="flex gap-2">
            <button onClick={exportRevenueCsv}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 transition-colors">
              Export CSV
            </button>
            <button onClick={addRevenue}
              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-colors"
              style={{ background: "#1B4965" }}>
              + Add row
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden border border-stone-800">
          <table className="w-full text-sm">
            <thead style={{ background: "#1a3044" }}>
              <tr className="text-xs text-stone-500 border-b border-stone-800">
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {revenues.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-600 text-sm">
                    No revenue entries yet — click &quot;+ Add row&quot; to record income
                  </td>
                </tr>
              )}
              {revenues.map(r => (
                <tr key={r.id} className="border-b border-stone-800/50 hover:bg-stone-800/20 transition-colors"
                  style={{ opacity: saving === r.id ? 0.5 : 1 }}>
                  <td className="px-4 py-3 text-stone-200">
                    <SelectCell value={r.source} options={REVENUE_SOURCES}
                      onCommit={v => updateRevenue(r.id, "source", v)}
                      className="text-stone-200" />
                  </td>
                  <td className="px-4 py-3 text-stone-400">
                    <SelectCell value={r.type} options={REVENUE_TYPES}
                      onCommit={v => updateRevenue(r.id, "type", v)}
                      className="text-stone-400" />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">
                    <EditCell value={r.amountGbp.toFixed(2)} type="number"
                      onCommit={v => updateRevenue(r.id, "amountGbp", v)}
                      className="text-right text-green-400" />
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    <EditCell value={r.notes ?? "—"} onCommit={v => updateRevenue(r.id, "notes", v)} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteRevenue(r.id)}
                      className="text-stone-600 hover:text-red-400 transition-colors text-xs">✕</button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: "#1a3044" }}>
                <td colSpan={2} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400">Total</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-green-400">{gbp(totalRevenue)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
