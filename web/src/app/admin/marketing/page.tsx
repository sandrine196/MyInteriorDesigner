"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { admin, type MarketingMetrics, type OnboardingFunnel, type BotActivity } from "@/lib/api";

const STYLE_LABELS: Record<string, string> = {
  // Living room / general
  modern_heritage: "Modern Heritage", warm_minimalism: "Warm Minimalism",
  midcentury: "Mid-Century Modern", biophilic: "Biophilic / Organic",
  english_cottage: "Elevated English Cottage", curated_maximalism: "Curated Maximalism",
  japandi: "Japandi", earthy_rustic: "Earthy Rustic",
  regencycore: "Regencycore Revival", hollywood_cottage: "Hollywood Cottage",
  // Bedroom
  bed_quiet_luxury: "Quiet Luxury", bed_scandi_cottage: "Scandi-Cottage",
  bed_earthy_bohemian: "Earthy Bohemian", bed_romantic_regency: "Romantic Regency",
  bed_soft_modern: "Soft Modern Minimalist", bed_atmospheric: "Dark & Moody",
  bed_coastal_calm: "Coastal Calm", bed_urban_loft: "Urban Loft",
  bed_midcentury_retro: "Mid-Century Retro", bed_biophilic: "Biophilic Sanctuary",
  // Dining
  dining_warm_minimalist: "Warm Minimalist", dining_modern_heritage: "Modern Heritage",
  dining_midcentury: "Mid-Century Modern", dining_japandi: "Japandi",
  dining_curated_maximalist: "Curated Maximalist", dining_organic_bohemian: "Organic Bohemian",
  dining_elevated_rustic: "Elevated European Rustic", dining_boutique_glamour: "Boutique Hotel Glamour",
  dining_industrial_loft: "Industrial Loft", dining_new_coastal: "New Coastal",
  // Bathroom
  bath_zen_spa: "Zen Spa", bath_modern_organic: "Modern Organic",
  bath_transitional: "Transitional", bath_neo_art_deco: "Neo-Art Deco",
  bath_european_vintage: "European Vintage", bath_coastal: "Coastal & Fresh",
  bath_industrial: "Industrial Chic", bath_boutique: "Boutique Hotel Luxury",
  bath_mediterranean: "Mediterranean Plaster", bath_color_drenched: "Colour-Drenched Modern",
  // Kitchen
  kitchen_modern_heritage: "Modern Heritage", kitchen_warm_minimalist: "Warm Minimalist",
  kitchen_organic_biophilic: "Organic / Biophilic", kitchen_transitional: "Sophisticated Transitional",
  kitchen_english_country: "English Country", kitchen_japandi: "Japandi",
  kitchen_industrial_refined: "Industrial Refined", kitchen_boutique_dramatic: "Boutique Dramatic",
  kitchen_coastal_organic: "Coastal Organic", kitchen_eclectic_collected: "Eclectic Collected",
};
const ROOM_LABELS: Record<string, string> = {
  living_room: "Living Room", dining_room: "Dining Room",
  living_dining: "Living / Dining", bedroom_primary: "Primary Bedroom",
  bedroom_secondary: "Guest Bedroom", home_office: "Home Office",
  bathroom: "Bathroom", kitchen: "Kitchen",
};
const COLORS = ["#1B4965", "#D4A574", "#2A5F7F", "#C4935F", "#4A8FA8", "#E5C9A8", "#163d54", "#6BAFC7"];
const BOT_REASON_LABELS: Record<string, string> = {
  honeypot: "Honeypot field filled",
  turnstile: "Turnstile failed",
  disposable_email: "Disposable email",
  dotted_gmail: "Dotted Gmail bypass",
  random_string_name: "Gibberish name",
};

type Range = "7d" | "30d" | "month" | "all";

const RANGES: { label: string; value: Range }[] = [
  { label: "Last 7 days",  value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month",   value: "month" },
  { label: "All time",     value: "all" },
];

function fmtDate(iso: string) { return iso.slice(5); }

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-4">{title}</h2>;
}
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "#1a3044", border: "1px solid #243d52" }}>
      <p className="text-sm font-medium text-stone-300 mb-4">{title}</p>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-stone-600 text-sm py-8 text-center">{text}</p>;
}

export default function MarketingPage() {
  const [data,      setData]      = useState<MarketingMetrics | null>(null);
  const [funnel,    setFunnel]    = useState<OnboardingFunnel | null>(null);
  const [botActivity, setBotActivity] = useState<BotActivity | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [range,     setRange]     = useState<Range>("30d");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, f, b] = await Promise.all([
        admin.marketingMetrics(range),
        admin.onboardingFunnel(range).catch(() => null),
        admin.botActivity(range).catch(() => null),
      ]);
      setData(d);
      setFunnel(f);
      setBotActivity(b);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename;
    a.click();
  };

  const totalClicks = data?.topProducts.reduce((s, p) => s + p.clicks, 0) ?? 0;

  return (
    <div className="space-y-10 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="text-stone-500 text-sm mt-1">Styles, room types, product clicks, and render trends</p>
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

      {funnel && funnel.stages.some(s => s.users > 0) && (
        <div>
          <SectionHeader title="Onboarding funnel" />
          <ChartCard title="Where users stall before their first design">
            <div className="space-y-2.5">
              {funnel.stages.map((s, i) => {
                const prev = i === 0 ? null : funnel.stages[i - 1];
                const bigDrop = !!prev && prev.users > 0 && s.dropFromPrev / prev.users >= 0.4;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="text-xs text-stone-400 w-40 shrink-0">{s.label}</span>
                    <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "#12222f" }}>
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${Math.max(s.pctOfStart, s.users > 0 ? 4 : 0)}%`,
                          background: bigDrop ? "#C4935F" : "#4A8FA8",
                        }}
                      />
                    </div>
                    <span className="text-xs text-stone-300 w-24 shrink-0 text-right">
                      {s.users} <span className="text-stone-600">({s.pctOfStart}%)</span>
                    </span>
                    <span className="text-xs w-20 shrink-0 text-right" style={{ color: bigDrop ? "#C4935F" : "#4b5563" }}>
                      {s.dropFromPrev > 0 ? `−${s.dropFromPrev}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-stone-600 mt-4 leading-relaxed">
              Distinct users reaching each step. Amber marks a drop of 40%+ from the previous step.
              Room size, floor plan and room layout are optional — low numbers there are expected.
            </p>
            {funnel.floorPlanAnalysis.total > 0 && (
              <p
                className="text-xs mt-2"
                style={{ color: funnel.floorPlanAnalysis.failed > 0 ? "#E5A54F" : "#4b5563" }}
              >
                Floor plan analysis: {funnel.floorPlanAnalysis.total - funnel.floorPlanAnalysis.failed}/
                {funnel.floorPlanAnalysis.total} succeeded
                {funnel.floorPlanAnalysis.failed > 0 && " — failures degrade render accuracy, check the AI model is current"}
              </p>
            )}
          </ChartCard>
        </div>
      )}

      {botActivity && (
        <div>
          <SectionHeader title="Bot activity" />
          <ChartCard title={`Registration attempts blocked${botActivity.total > 0 ? ` — ${botActivity.total} total` : ""}`}>
            {botActivity.total === 0 ? (
              <Empty text="No bots blocked in this period" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={botActivity.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3d54" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#57534e" fontSize={11} />
                    <YAxis stroke="#57534e" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#12222f", border: "1px solid #243d52", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(label) => fmtDate(String(label))}
                    />
                    <Bar dataKey="count" fill="#C4935F" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs font-medium text-stone-400 mb-2">By defense</p>
                    <div className="space-y-1.5">
                      {Object.entries(botActivity.byReason).sort(([, a], [, b]) => b - a).map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between text-xs">
                          <span className="text-stone-300">{BOT_REASON_LABELS[reason] ?? reason}</span>
                          <span className="text-stone-500">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-400 mb-2">By route</p>
                    <div className="space-y-1.5">
                      {Object.entries(botActivity.byRoute).sort(([, a], [, b]) => b - a).map(([route, count]) => (
                        <div key={route} className="flex items-center justify-between text-xs">
                          <span className="text-stone-300">{route === "register" ? "Homeowner sign-up" : route === "agents_register" ? "Agent sign-up" : route}</span>
                          <span className="text-stone-500">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {botActivity.lastBlockedAt && (
                  <p className="text-xs text-stone-600 mt-4">
                    Last blocked {new Date(botActivity.lastBlockedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </>
            )}
          </ChartCard>
        </div>
      )}

      {data && (
        <>
          {/* ── Render trend ──────────────────────────────────────────── */}
          <div>
            <SectionHeader title="Render activity" />
            <ChartCard title="Renders generated per day">
              {data.renderTrend.every(d => d.count === 0) ? (
                <Empty text="No renders generated yet" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.renderTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3d54" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "#78716c", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#78716c", fontSize: 11 }} width={28} />
                    <Tooltip
                      contentStyle={{ background: "#0f2535", border: "1px solid #243d52", borderRadius: 8 }}
                      labelStyle={{ color: "#d6d3d1" }}
                    />
                    <Line type="monotone" dataKey="count" stroke="#D4A574" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Style + Room type ─────────────────────────────────────── */}
          <div>
            <SectionHeader title="Design preferences" />
            <div className="grid md:grid-cols-2 gap-5">

              {/* Popular styles */}
              <div className="rounded-2xl overflow-hidden border border-stone-800">
                <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800" style={{ background: "#1a3044" }}>
                  <p className="text-sm font-medium text-stone-300">Popular design styles</p>
                  <button
                    onClick={() => exportCsv(
                      [["Rank","Style","Count","% of total"],
                       ...data.styleDistribution.map((s, i) => [String(i+1), STYLE_LABELS[s.style ?? ""] ?? s.style ?? "—", String(s.count), `${s.pct}%`])],
                      "styles.csv",
                    )}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                  >Export CSV</button>
                </div>
                {data.styleDistribution.length === 0 ? (
                  <Empty text="No projects created yet" />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-stone-500 border-b border-stone-800">
                        <th className="text-left px-5 py-2 font-medium">#</th>
                        <th className="text-left px-5 py-2 font-medium">Style</th>
                        <th className="text-right px-5 py-2 font-medium">Projects</th>
                        <th className="text-right px-5 py-2 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.styleDistribution.map((s, i) => (
                        <tr key={s.style} className="border-b border-stone-800/50 hover:bg-stone-800/20">
                          <td className="px-5 py-2.5 text-stone-600 text-xs">{i + 1}</td>
                          <td className="px-5 py-2.5 text-stone-200">{STYLE_LABELS[s.style ?? ""] ?? s.style}</td>
                          <td className="px-5 py-2.5 text-right text-white font-semibold">{s.count}</td>
                          <td className="px-5 py-2.5 text-right text-stone-400">{s.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Room types */}
              <ChartCard title="Room types">
                {data.roomTypeDistribution.length === 0 ? (
                  <Empty text="No projects created yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.roomTypeDistribution.map(r => ({
                        name: ROOM_LABELS[r.roomType ?? ""] ?? r.roomType ?? "Unknown",
                        count: r.count, pct: r.pct,
                      }))}
                      layout="vertical" margin={{ left: 0 }}
                    >
                      <XAxis type="number" tick={{ fill: "#78716c", fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#a8a29e", fontSize: 10 }} width={110} />
                      <Tooltip
                        contentStyle={{ background: "#0f2535", border: "1px solid #243d52", borderRadius: 8 }}
                        itemStyle={{ color: "#d6d3d1" }}
                        formatter={(v, _n, p) => [`${Number(v)} (${(p as { payload: { pct: number } }).payload.pct}%)`]}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {data.roomTypeDistribution.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </div>

          {/* ── Product clicks ────────────────────────────────────────── */}
          <div>
            <SectionHeader title="Product engagement" />
            <div className="grid md:grid-cols-3 gap-5">

              {/* Top products */}
              <div className="md:col-span-2 rounded-2xl overflow-hidden border border-stone-800">
                <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800" style={{ background: "#1a3044" }}>
                  <p className="text-sm font-medium text-stone-300">Most clicked products</p>
                  <button
                    onClick={() => exportCsv(
                      [["Rank","Product","Retailer","Clicks"],
                       ...data.topProducts.map((p, i) => [String(i+1), p.productName, p.retailer, String(p.clicks)])],
                      "product-clicks.csv",
                    )}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                  >Export CSV</button>
                </div>
                {data.topProducts.length === 0 ? (
                  <div className="px-5 py-8 text-center text-stone-600 text-sm">
                    <p>No product clicks recorded yet.</p>
                    <p className="mt-1">Clicks are tracked automatically when users visit product pages.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-stone-500 border-b border-stone-800">
                        <th className="text-left px-5 py-2 font-medium">#</th>
                        <th className="text-left px-5 py-2 font-medium">Product</th>
                        <th className="text-left py-2 font-medium">Retailer</th>
                        <th className="text-right px-5 py-2 font-medium">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProducts.map((p, i) => (
                        <tr key={p.productId} className="border-b border-stone-800/50 hover:bg-stone-800/20">
                          <td className="px-5 py-2.5 text-stone-600 text-xs">{i + 1}</td>
                          <td className="px-5 py-2.5 text-stone-200 max-w-xs truncate">{p.productName}</td>
                          <td className="py-2.5 text-stone-400 capitalize">{p.retailer.replace(/_/g, " ")}</td>
                          <td className="px-5 py-2.5 text-right text-white font-semibold">{p.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Retailer pie */}
              <ChartCard title="Clicks by retailer">
                {data.retailerClicks.length === 0 ? (
                  <Empty text="No clicks yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.retailerClicks.map(r => ({
                          name: r.retailer.replace(/_/g, " "), value: r.clicks,
                        }))}
                        cx="50%" cy="45%" innerRadius={40} outerRadius={70}
                        dataKey="value" paddingAngle={2}
                      >
                        {data.retailerClicks.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#0f2535", border: "1px solid #243d52", borderRadius: 8 }}
                        itemStyle={{ color: "#d6d3d1" }}
                        formatter={(v) => { const n = Number(v); return [`${n} clicks (${totalClicks > 0 ? Math.round(n/totalClicks*100) : 0}%)`]; }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, color: "#78716c" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
