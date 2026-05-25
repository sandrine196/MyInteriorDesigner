"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { admin, type MarketingMetrics } from "@/lib/api";

const STYLE_LABELS: Record<string, string> = {
  scandi: "Scandi Minimalist", industrial: "Modern Industrial",
  traditional: "Cosy Traditional", midcentury: "Mid-Century Modern",
  bohemian: "Bohemian", contemporary: "Contemporary Luxe",
  japandi: "Japandi", coastal: "Coastal",
};

const ROOM_LABELS: Record<string, string> = {
  living_room: "Living Room", dining_room: "Dining Room",
  living_dining: "Living / Dining", bedroom_primary: "Primary Bedroom",
  bedroom_secondary: "Guest Bedroom", home_office: "Home Office",
};

const COLORS = ["#1B4965", "#D4A574", "#2A5F7F", "#C4935F", "#4A8FA8", "#E5C9A8", "#163d54", "#6BAFC7"];

function fmtDate(iso: string) {
  return iso.slice(5); // MM-DD
}

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

export default function MarketingPage() {
  const [data,    setData]    = useState<MarketingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    admin.marketingMetrics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const exportCsv = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = filename;
    a.click();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
    </div>
  );
  if (error || !data) return (
    <div className="text-red-400 bg-red-950 border border-red-900 rounded-2xl p-6 text-sm">{error || "Failed"}</div>
  );

  const totalClicks = data.topProducts.reduce((s, p) => s + p.clicks, 0);

  return (
    <div className="space-y-10 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketing</h1>
        <p className="text-stone-500 text-sm mt-1">Styles, room types, product clicks, and render trends</p>
      </div>

      {/* ── Render trend ──────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Render activity — last 30 days" />
        <ChartCard title="Renders generated per day">
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
        </ChartCard>
      </div>

      {/* ── Style + Room type ─────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Design preferences" />
        <div className="grid md:grid-cols-2 gap-5">

          {/* Popular styles table */}
          <div className="rounded-2xl overflow-hidden border border-stone-800">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800"
              style={{ background: "#1a3044" }}>
              <p className="text-sm font-medium text-stone-300">Popular design styles</p>
              <button
                onClick={() => exportCsv(
                  [["Rank","Style","Count","% of total"], ...data.styleDistribution.map((s, i) =>
                    [String(i+1), STYLE_LABELS[s.style ?? ""] ?? s.style ?? "—", String(s.count), `${s.pct}%`])],
                  "styles.csv"
                )}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
              >Export CSV</button>
            </div>
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
                {data.styleDistribution.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-stone-600">No data yet</td></tr>
                )}
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
          </div>

          {/* Room types chart */}
          <ChartCard title="Room types">
            {data.roomTypeDistribution.length === 0 ? (
              <p className="text-stone-600 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.roomTypeDistribution.map(r => ({
                    name: ROOM_LABELS[r.roomType ?? ""] ?? r.roomType ?? "Unknown",
                    count: r.count,
                    pct: r.pct,
                  }))}
                  layout="vertical"
                  margin={{ left: 0 }}
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

      {/* ── Product clicks ────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Product engagement" />
        <div className="grid md:grid-cols-3 gap-5">

          {/* Top products table */}
          <div className="md:col-span-2 rounded-2xl overflow-hidden border border-stone-800">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800"
              style={{ background: "#1a3044" }}>
              <p className="text-sm font-medium text-stone-300">Most clicked products</p>
              <button
                onClick={() => exportCsv(
                  [["Rank","Product","Retailer","Clicks","Est. Conv."],
                   ...data.topProducts.map((p, i) => [String(i+1), p.productName, p.retailer, String(p.clicks), "—"])],
                  "product-clicks.csv"
                )}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
              >Export CSV</button>
            </div>
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
                {data.topProducts.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-stone-600">
                    No clicks yet — clicks are tracked when users visit product pages
                  </td></tr>
                )}
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
          </div>

          {/* Retailer pie */}
          <ChartCard title="Clicks by retailer">
            {data.retailerClicks.length === 0 ? (
              <p className="text-stone-600 text-sm py-8 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.retailerClicks.map(r => ({
                      name: r.retailer.replace(/_/g, " "),
                      value: r.clicks,
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
    </div>
  );
}
