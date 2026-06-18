"use client";
import { useEffect, useState } from "react";
import { admin, type RedesignMetrics } from "@/lib/api";

type Range = "7d" | "30d" | "month" | "all";
const RANGES: { label: string; value: Range }[] = [
  { label: "Last 7 days",  value: "7d"   },
  { label: "Last 30 days", value: "30d"  },
  { label: "This month",   value: "month"},
  { label: "All time",     value: "all"  },
];

const STYLE_LABELS: Record<string, string> = {
  scandinavian: "Scandinavian",
  modern:       "Modern",
  traditional:  "Traditional",
  industrial:   "Industrial",
  coastal:      "Coastal",
  mid_century:  "Mid-Century",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl p-5 space-y-1" style={{ background: "#122c3f", border: "1px solid #1e3d54" }}>
      <p className="text-xs text-stone-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

export default function AdminRedesignPage() {
  const [data,    setData]    = useState<RedesignMetrics | null>(null);
  const [range,   setRange]   = useState<Range>("30d");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    setLoading(true);
    admin.redesignMetrics(range)
      .then(setData)
      .catch(() => setError("Failed to load redesign metrics"))
      .finally(() => setLoading(false));
  }, [range]);

  const funnel = data?.funnel;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Instant Redesign</h1>
          <p className="text-stone-400 text-sm mt-1">Viral acquisition funnel — free, no login</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={range === r.value
                ? { background: "rgba(212,165,116,0.2)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.4)" }
                : { background: "#1a3044", color: "#6b7a88", border: "1px solid #1e3d54" }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-stone-500 text-sm">Loading…</p>}

      {data && (
        <>
          {/* ── Summary stats ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Sessions"       value={data.totalSessions} />
            <StatCard label="Full redesigns" value={data.totalRedesigns} />
            <StatCard label="Restages"       value={data.totalRestages} />
            <StatCard label="Completion rate" value={`${data.completionRate}%`} sub="started → completed" />
          </div>

          {/* ── Funnel ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: "#122c3f", borderColor: "#1e3d54" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#1e3d54" }}>
              <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wider">Funnel</h2>
            </div>
            <div className="divide-y" style={{ borderColor: "#1e3d54" }}>
              {([
                { key: "redesign_started",           label: "Started a redesign",          base: true },
                { key: "redesign_completed",          label: "Redesign completed",           base: false },
                { key: "redesign_try_another_style",  label: "Tried another style",          base: false },
                { key: "redesign_signup_clicked",     label: "Clicked 'Sign up'",            base: false },
                { key: "redesign_limit_hit",          label: "Hit the daily limit",          base: false },
              ] as const).map(({ key, label, base }) => {
                const count   = funnel?.[key] ?? 0;
                const started = funnel?.redesign_started ?? 1;
                const pct     = base ? 100 : Math.round(count / Math.max(started, 1) * 100);
                return (
                  <div key={key} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-200">{label}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-1.5 rounded-full bg-stone-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#D4A574" }} />
                      </div>
                      <span className="text-xs text-stone-400 w-8 text-right">{pct}%</span>
                      <span className="text-sm font-semibold text-white w-10 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Conversion rate + style breakdown ─────────────────────── */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Conversion */}
            <div className="rounded-2xl border p-5 space-y-4" style={{ background: "#122c3f", borderColor: "#1e3d54" }}>
              <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wider">Conversion</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-stone-400 mb-1">
                    <span>Redesign → Sign up clicked</span>
                    <span className="font-semibold text-white">{data.signupRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-800">
                    <div className="h-full rounded-full" style={{ width: `${data.signupRate}%`, background: "#D4A574" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-stone-400 mb-1">
                    <span>Started → Completed</span>
                    <span className="font-semibold text-white">{data.completionRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-800">
                    <div className="h-full rounded-full" style={{ width: `${data.completionRate}%`, background: "#2A5F7F" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Style breakdown */}
            <div className="rounded-2xl border p-5 space-y-3" style={{ background: "#122c3f", borderColor: "#1e3d54" }}>
              <h2 className="text-sm font-semibold text-stone-300 uppercase tracking-wider">Styles chosen</h2>
              {Object.keys(data.styleBreakdown).length === 0 ? (
                <p className="text-stone-600 text-sm">No data yet</p>
              ) : (
                Object.entries(data.styleBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([style, count]) => {
                    const total = Object.values(data.styleBreakdown).reduce((s, n) => s + n, 0);
                    const pct   = Math.round(count / Math.max(total, 1) * 100);
                    return (
                      <div key={style} className="flex items-center gap-3">
                        <span className="text-xs text-stone-400 w-24 truncate">{STYLE_LABELS[style] ?? style}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-stone-800">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#D4A574" }} />
                        </div>
                        <span className="text-xs text-stone-400 w-8 text-right">{pct}%</span>
                        <span className="text-xs font-semibold text-white w-6 text-right">{count}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
