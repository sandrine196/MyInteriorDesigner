"use client";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { agents, ApiError, getAgentToken, clearAgentToken, type StagingRender } from "@/lib/api";
import { config } from "@/config";

// ── Style catalogue (extended for virtual staging — no product constraints) ────

const STAGING_STYLES = [
  { id: "scandi",         label: "Scandi Minimalist",   desc: "Clean lines, pale woods, natural textures" },
  { id: "contemporary",   label: "Contemporary Luxe",   desc: "Sleek, sophisticated, polished finishes" },
  { id: "japandi",        label: "Japandi",             desc: "Japanese-Scandi harmony, wabi-sabi calm" },
  { id: "traditional",    label: "Cosy Traditional",    desc: "Warm fabrics, classic patterns, rich colours" },
  { id: "midcentury",     label: "Mid-Century Modern",  desc: "Bold organic shapes, warm wood, retro palette" },
  { id: "coastal",        label: "Coastal",             desc: "Light, breezy, natural fibres, sea tones" },
  { id: "industrial",     label: "Modern Industrial",   desc: "Raw metals, exposed brick, dark tones" },
  { id: "bohemian",       label: "Bohemian",            desc: "Eclectic, layered, colourful, free-spirited" },
  { id: "art_deco",       label: "Art Deco",            desc: "Geometric glamour, gold accents, bold symmetry" },
  { id: "farmhouse",      label: "Modern Farmhouse",    desc: "Relaxed, rustic warmth, shiplap and linen" },
  { id: "period",         label: "Period / Georgian",   desc: "Elegant proportions for older UK properties" },
  { id: "new_build",      label: "Contemporary New Build", desc: "Fresh, minimal, perfect for modern homes" },
  { id: "maximalist",     label: "Maximalist",          desc: "Bold, layered, rich textures and pattern" },
  { id: "french_country", label: "French Country",      desc: "Rustic elegance, soft linens, aged wood" },
  { id: "biophilic",      label: "Biophilic",           desc: "Nature-forward, plants, organic materials" },
];

const ROOM_TYPES = [
  "Living room", "Bedroom", "Master bedroom", "Kitchen / diner",
  "Dining room", "Home office", "Open-plan living", "Studio flat",
];

const WALL_PALETTES = [
  { id: "neutral",  label: "White / Off-white" },
  { id: "warm",     label: "Warm tones (beige, cream)" },
  { id: "cold",     label: "Cool tones (grey, blue)" },
  { id: "pale",     label: "Pale pastel" },
  { id: "vivid",    label: "Bold / statement colour" },
];

const FLOORING = [
  { id: "pale_wood", label: "Pale wood (oak, birch)" },
  { id: "dark_wood", label: "Dark wood (walnut)" },
  { id: "warm_oak",  label: "Warm oak" },
  { id: "carpet",    label: "Carpet" },
  { id: "tiles",     label: "Tiles / stone" },
];

// ── Style chip ─────────────────────────────────────────────────────────────────

function StyleChip({
  style, selected, onToggle, disabled,
}: {
  style: typeof STAGING_STYLES[number];
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="text-left rounded-xl border px-3 py-2.5 transition-all disabled:opacity-40"
      style={selected
        ? { borderColor: "#D4A574", background: "rgba(212,165,116,0.1)", color: "#062C3D" }
        : { borderColor: "#E7E5E0", background: "white", color: "#6B7280" }}
    >
      <p className="text-xs font-semibold" style={{ color: selected ? "#062C3D" : "#374151" }}>{style.label}</p>
      <p className="text-[10px] mt-0.5 leading-tight" style={{ color: selected ? "#5A7A8A" : "#9CA3AF" }}>{style.desc}</p>
      {selected && (
        <span className="inline-block mt-1 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded-full"
          style={{ background: "#D4A574", color: "#1B3050" }}>SELECTED</span>
      )}
    </button>
  );
}

// ── Result card ────────────────────────────────────────────────────────────────

function RenderCard({ render, index }: { render: StagingRender; index: number }) {
  const styleLabel = STAGING_STYLES.find(s => s.id === render.style)?.label ?? render.style;
  const imageUrl = render.imageUrl.startsWith("http")
    ? render.imageUrl
    : `${config.apiUrl}${render.imageUrl}`;

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${styleLabel} virtual staging`}
        className="w-full aspect-[4/3] object-cover"
      />
      <div className="p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">{styleLabel}</p>
          <p className="text-xs text-stone-400 mt-0.5">Render {index + 1} of {render.mock ? " (mock)" : ""}</p>
        </div>
        <a
          href={imageUrl}
          download={`mid-staging-${render.style}-${Date.now()}.png`}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition-colors border shrink-0"
          style={{ background: "#062C3D", color: "white", borderColor: "#062C3D" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

function StagingContent() {
  const router = useRouter();

  useEffect(() => {
    if (!getAgentToken()) router.replace("/agent-login");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [roomType,         setRoomType]         = useState(ROOM_TYPES[0]);
  const [customRoomType,   setCustomRoomType]    = useState("");
  const [selectedStyles,   setSelectedStyles]    = useState<string[]>(["contemporary"]);
  const [wallPalette,      setWallPalette]       = useState("neutral");
  const [flooring,         setFlooring]          = useState("pale_wood");
  const [lengthM,          setLengthM]           = useState("4.5");
  const [widthM,           setWidthM]            = useState("3.5");
  const [ceilingM,         setCeilingM]          = useState("2.5");

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [renders,  setRenders]  = useState<StagingRender[] | null>(null);

  function toggleStyle(id: string) {
    setSelectedStyles(prev => {
      if (prev.includes(id)) return prev.length > 1 ? prev.filter(s => s !== id) : prev;
      if (prev.length >= 3)  return prev; // max 3
      return [...prev, id];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setRenders(null);
    try {
      const effectiveRoomType = roomType === "Other" ? (customRoomType || "room") : roomType;
      const res = await agents.staging({
        roomType:         effectiveRoomType,
        designStyles:     selectedStyles,
        wallColorPalette: wallPalette,
        flooringType:     flooring,
        roomLengthMm:     Math.round(parseFloat(lengthM)  * 1000),
        roomWidthMm:      Math.round(parseFloat(widthM)   * 1000),
        ceilingHeightMm:  Math.round(parseFloat(ceilingM) * 1000),
      });
      setRenders(res.renders);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAgentToken();
        router.replace("/agent-login");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong — please try again");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/MIDLogo.png" alt="My Interior Designer" width={120} height={84} className="h-9 w-auto object-contain" priority />
            <span className="font-semibold text-[#062C3D] tracking-tight hidden sm:block text-sm">Virtual Staging</span>
          </Link>
          <Link
            href="/agent-dashboard"
            className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Page title */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest rounded-full px-3 py-1.5 mb-3"
            style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
            ESTATE AGENT — VIRTUAL STAGING
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Stage any room in seconds</h1>
          <p className="text-stone-500 text-sm mt-1.5 max-w-lg">
            AI generates photorealistic furnished renders of empty rooms — no real furniture needed.
            Download and use directly in your property listing.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* ── Form ──────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-6">

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
            )}

            {/* Room type */}
            <div>
              <label className="block text-sm font-semibold text-stone-800 mb-2">Room type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[...ROOM_TYPES, "Other"].map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setRoomType(rt)}
                    className="text-xs font-medium px-3 py-2 rounded-lg border transition-all text-left"
                    style={roomType === rt
                      ? { borderColor: "#062C3D", background: "#062C3D", color: "white" }
                      : { borderColor: "#E7E5E0", background: "white", color: "#374151" }}
                  >
                    {rt}
                  </button>
                ))}
              </div>
              {roomType === "Other" && (
                <input
                  type="text"
                  value={customRoomType}
                  onChange={(e) => setCustomRoomType(e.target.value)}
                  placeholder="e.g. sunroom, utility room…"
                  className="mt-2 w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              )}
            </div>

            {/* Style selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-stone-800">Design style</label>
                <span className="text-xs text-stone-400">
                  {selectedStyles.length}/3 selected
                  {selectedStyles.length < 3 ? " — add more for comparison" : " — max"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STAGING_STYLES.map((style) => (
                  <StyleChip
                    key={style.id}
                    style={style}
                    selected={selectedStyles.includes(style.id)}
                    onToggle={() => toggleStyle(style.id)}
                    disabled={!selectedStyles.includes(style.id) && selectedStyles.length >= 3}
                  />
                ))}
              </div>
            </div>

            {/* Surfaces */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-2">Wall colour</label>
                <div className="space-y-1.5">
                  {WALL_PALETTES.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="wall"
                        value={p.id}
                        checked={wallPalette === p.id}
                        onChange={() => setWallPalette(p.id)}
                        className="accent-[#062C3D]"
                      />
                      <span className="text-sm text-stone-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-800 mb-2">Flooring</label>
                <div className="space-y-1.5">
                  {FLOORING.map((f) => (
                    <label key={f.id} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="floor"
                        value={f.id}
                        checked={flooring === f.id}
                        onChange={() => setFlooring(f.id)}
                        className="accent-[#062C3D]"
                      />
                      <span className="text-sm text-stone-700">{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-semibold text-stone-800 mb-2">Room dimensions (metres)</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Length",  value: lengthM,  set: setLengthM },
                  { label: "Width",   value: widthM,   set: setWidthM },
                  { label: "Ceiling", value: ceilingM, set: setCeilingM },
                ].map(({ label, value, set }) => (
                  <div key={label}>
                    <p className="text-xs text-stone-500 mb-1">{label}</p>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || selectedStyles.length === 0}
              className="w-full disabled:opacity-50 rounded-xl py-3.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
              style={{ background: "#062C3D", color: "white" }}
            >
              {loading
                ? `Generating ${selectedStyles.length} render${selectedStyles.length > 1 ? "s" : ""}…`
                : `Generate ${selectedStyles.length} virtual staging render${selectedStyles.length > 1 ? "s" : ""} →`}
            </button>

            <p className="text-xs text-center text-stone-400">
              Renders take 15–30 seconds each. Generated in parallel — multiple styles arrive together.
            </p>
          </form>

          {/* ── Results / sidebar ────────────────────────────────────── */}
          <div className="space-y-4">
            {loading && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-stone-200 border-t-[#D4A574] animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-stone-700">Staging your room…</p>
                <p className="text-xs text-stone-400 mt-1">Gemini is imagining the perfect furniture.</p>
                {selectedStyles.length > 1 && (
                  <p className="text-xs text-stone-400 mt-1">
                    Generating {selectedStyles.length} styles in parallel.
                  </p>
                )}
              </div>
            )}

            {renders && renders.map((render, i) => (
              <RenderCard key={render.style + i} render={render} index={i} />
            ))}

            {!loading && !renders && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{ background: "#EEF6F8" }}>
                  🏠
                </div>
                <p className="text-sm font-semibold text-stone-700 mb-1">Your renders appear here</p>
                <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
                  Select a room type and style, set the dimensions, and hit generate. Download renders straight to your device.
                </p>
              </div>
            )}

            {renders && (
              <div className="rounded-2xl p-4 border text-xs text-stone-500 leading-relaxed"
                style={{ background: "#EEF6F8", borderColor: "#AECFDB" }}>
                <p className="font-semibold text-stone-700 mb-1">Using these renders</p>
                <p>These AI renders are for illustrative purposes to help buyers visualise potential. Always include a disclaimer in your listing (e.g. &ldquo;Images are for illustrative purposes only — computer-generated staging&rdquo;).</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AgentStagingPage() {
  return <StagingContent />;
}
