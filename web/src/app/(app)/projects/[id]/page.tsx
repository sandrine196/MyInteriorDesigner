"use client";
import { useEffect, useState, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  projects as api,
  products as productsApi,
  usage as usageApi,
  ApiError,
  type Project,
  type Product,
  type Render,
  type RenderProduct,
  type ProjectSetup,
  type Usage,
  type RoomFeatures,
  type WallRole,
} from "@/lib/api";
import FloorPlanMapper from "@/components/FloorPlanMapper";
import RoomSummary from "@/components/RoomSummary";
import ProductLink from "@/components/ProductLink";
import { config } from "@/config";

const API_BASE = config.apiUrl;

function mmToM(mm: number | null) {
  return mm != null ? (mm / 1000).toFixed(2) : "";
}

// ── Onboarding constants ──────────────────────────────────────────────────────

const BUDGET_OPTIONS = [
  { label: "£500 – £1,000",   min: 500,  max: 1000  },
  { label: "£1,000 – £2,500", min: 1000, max: 2500  },
  { label: "£2,500 – £5,000", min: 2500, max: 5000  },
  { label: "£5,000+",         min: 5000, max: null   },
];

const SHOPS = [
  { id: "john_lewis", label: "John Lewis" },
  { id: "wayfair",    label: "Wayfair" },
  { id: "habitat",    label: "Habitat" },
  { id: "dunelm",      label: "Dunelm" },
  { id: "la_redoute", label: "La Redoute" },
  { id: "muji",       label: "Muji" },
  { id: "amazon",     label: "Amazon" },
];

const WALL_COLORS = [
  { id: "pale",    label: "Pale",    desc: "Light, airy",                  swatch: "#EDE8DC" },
  { id: "cold",    label: "Cold",    desc: "Grays & blues",                swatch: "#C4CDD8" },
  { id: "warm",    label: "Warm",    desc: "Beiges, creams & terracotta",  swatch: "#D9B99A" },
  { id: "vivid",   label: "Vivid",   desc: "Bold colours",                 swatch: "#9B8DC4" },
  { id: "neutral", label: "Neutral", desc: "White & off-white",            swatch: "#F5F4F2" },
  { id: "custom",  label: "Custom",  desc: "Enter a specific colour",      swatch: null },
];

const FLOORING_TYPES = [
  { id: "pale_wood", label: "Pale wood", desc: "Light oak, birch",     swatch: "#D4B88A" },
  { id: "dark_wood", label: "Dark wood", desc: "Walnut, mahogany",     swatch: "#4A2E1A" },
  { id: "warm_oak",  label: "Warm oak",  desc: "Medium honey tones",   swatch: "#C4834E" },
  { id: "carpet",    label: "Carpet",    desc: "Soft, specify if needed", swatch: "#B0A89C" },
  { id: "tiles",     label: "Tiles",     desc: "Ceramic, stone",       swatch: "#C8C4BC" },
];

const DESIGN_STYLES = [
  { id: "scandi",       label: "Scandi Minimalist",   desc: "Clean lines, pale woods, natural textures",    from: "#F0EDE8", to: "#D4C9B5" },
  { id: "industrial",   label: "Modern Industrial",   desc: "Raw metals, exposed brick, dark tones",         from: "#3D3D3D", to: "#2A2A2A" },
  { id: "traditional",  label: "Cosy Traditional",    desc: "Warm fabrics, classic patterns, rich colours",  from: "#7B4343", to: "#5C3232" },
  { id: "midcentury",   label: "Mid-Century Modern",  desc: "Bold organic shapes, warm wood, retro palette", from: "#D4A847", to: "#B07D2E" },
  { id: "bohemian",     label: "Bohemian",            desc: "Eclectic, layered, colourful, free-spirited",   from: "#C17B4B", to: "#7B3D73" },
  { id: "contemporary", label: "Contemporary Luxe",   desc: "Sleek, sophisticated, polished finishes",       from: "#4A4A4A", to: "#1C1C1C" },
  { id: "japandi",      label: "Japandi",             desc: "Japanese-Scandi harmony, wabi-sabi calm",       from: "#D4C9B5", to: "#8B9E8B" },
  { id: "coastal",      label: "Coastal",             desc: "Light, breezy, natural fibres, sea tones",      from: "#7BACC4", to: "#BDD9E8" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Dimensions
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [savingDims, setSavingDims] = useState(false);
  const [dimsError, setDimsError] = useState("");

  // Floor plan
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFloor, setUploadingFloor] = useState(false);
  const [floorError, setFloorError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [floorImgError, setFloorImgError] = useState(false);

  // Products
  const [productList, setProductList] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedProductsData, setSelectedProductsData] = useState<Map<string, Product>>(new Map());
  const [productSearch, setProductSearch] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);

  // Room features
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [editingFeatures, setEditingFeatures] = useState(false);

  // Render
  const [prompt, setPrompt] = useState("");
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [usageData, setUsageData] = useState<Usage | null>(null);

  // Onboarding
  const [budgetBracket, setBudgetBracket] = useState<typeof BUDGET_OPTIONS[number] | null>(null);
  const [selectedShops, setSelectedShops] = useState<string[]>(SHOPS.map((s) => s.id));
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedWallColor, setSelectedWallColor] = useState<string | null>(null);
  const [customWallColor, setCustomWallColor] = useState("");
  const [selectedFlooring, setSelectedFlooring] = useState<string | null>(null);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [setupError, setSetupError] = useState("");

  // Furniture mode
  const [furnitureMode, setFurnitureMode] = useState<"auto" | "manual">("auto");

  // Edit preferences panel
  const [editingPrefs, setEditingPrefs] = useState(false);

  useEffect(() => {
    usageApi.get().then(setUsageData).catch(() => {});
    api.get(id)
      .then(({ project: p }) => {
        setProject(p);
        setLength(mmToM(p.roomLengthMm));
        setWidth(mmToM(p.roomWidthMm));
        setCeiling(mmToM(p.ceilingHeightMm));
        if (p.budgetMin != null) {
          const match = BUDGET_OPTIONS.find((b) => b.min === p.budgetMin && b.max === p.budgetMax);
          if (match) setBudgetBracket(match);
        }
        if (p.preferredRetailers.length) setSelectedShops(p.preferredRetailers);
        if (p.designStyle) setSelectedStyle(p.designStyle);
        if (p.wallColorPalette) {
          const known = WALL_COLORS.find((w) => w.id === p.wallColorPalette);
          if (known) { setSelectedWallColor(p.wallColorPalette); }
          else { setSelectedWallColor("custom"); setCustomWallColor(p.wallColorPalette!); }
        }
        if (p.flooringType) setSelectedFlooring(p.flooringType);
      })
      .catch(() => router.replace("/projects"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const setupComplete =
    project !== null &&
    project.designStyle !== null &&
    project.wallColorPalette !== null &&
    project.flooringType !== null;
  const retailersKey = project?.preferredRetailers.join(",") ?? "";
  const maxBudget = project?.budgetMax ?? null;

  useEffect(() => {
    if (!setupComplete) return;
    setProductsLoading(true);
    const params: Parameters<typeof productsApi.list>[0] = {
      q: productSearch || undefined,
      limit: 30,
      projectId: id,
    };
    if (retailersKey) params.retailers = retailersKey.split(",");
    if (maxBudget != null) params.maxPrice = maxBudget;
    productsApi.list(params)
      .then((r) => setProductList(r.items))
      .finally(() => setProductsLoading(false));
  }, [productSearch, setupComplete, retailersKey, maxBudget]);

  async function submitSetup() {
    if (!budgetBracket)   { setSetupError("Please select a budget range."); return; }
    if (!selectedStyle)   { setSetupError("Please select a design style."); return; }
    if (!selectedWallColor) { setSetupError("Please select a wall colour palette."); return; }
    if (selectedWallColor === "custom" && !customWallColor.trim()) {
      setSetupError("Please describe your custom wall colour."); return;
    }
    if (!selectedFlooring) { setSetupError("Please select a flooring type."); return; }
    setSetupError("");
    setSubmittingSetup(true);
    try {
      const data: ProjectSetup = {
        budgetMin: budgetBracket.min,
        budgetMax: budgetBracket.max,
        preferredRetailers: selectedShops,
        designStyle: selectedStyle,
        wallColorPalette: selectedWallColor === "custom" ? customWallColor.trim() : selectedWallColor,
        flooringType: selectedFlooring,
      };
      const { project: p } = await api.updateSetup(id, data);
      setProject(p);
      setEditingPrefs(false);
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : "Failed to save preferences");
    } finally {
      setSubmittingSetup(false);
    }
  }

  async function saveDimensions(e: FormEvent) {
    e.preventDefault();
    setDimsError("");
    setSavingDims(true);
    try {
      const { project: p } = await api.setDimensions(id, {
        roomLengthMm: Math.round(parseFloat(length) * 1000),
        roomWidthMm: Math.round(parseFloat(width) * 1000),
        ceilingHeightMm: Math.round(parseFloat(ceiling) * 1000),
      });
      setProject(p);
    } catch (err) {
      setDimsError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setSavingDims(false);
    }
  }

  async function uploadFloorPlan(file: File) {
    setFloorError("");
    setFloorImgError(false);
    setUploadingFloor(true);
    try {
      const { floorPlanKey, floorPlanUrl } = await api.uploadFloorPlan(id, file);
      setProject((p) => (p ? { ...p, floorPlanKey, floorPlanUrl } : p));
      setUploadedFileName(file.name);
    } catch (err) {
      setFloorError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploadingFloor(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function generateRender(e: FormEvent) {
    e.preventDefault();
    setRenderError("");
    setRendering(true);
    try {
      const productIds = furnitureMode === "manual" ? [...selectedProducts] : [];
      const { render } = await api.createRender(id, prompt, productIds);
      const [{ project: p }, freshUsage] = await Promise.all([api.get(id), usageApi.get()]);
      setProject(p);
      setUsageData(freshUsage);
      setPrompt("");
      document.getElementById(`render-${render.id}`)?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setRenderError("FREE_LIMIT_REACHED");
      } else {
        setRenderError(err instanceof ApiError ? err.message : "Render failed");
      }
    } finally {
      setRendering(false);
    }
  }

  function toggleProduct(pid: string) {
    const product = productList.find((p) => p.id === pid);
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
    setSelectedProductsData((prev) => {
      const next = new Map(prev);
      if (next.has(pid)) { next.delete(pid); }
      else if (product) { next.set(pid, product); }
      return next;
    });
  }

  function toggleShop(shopId: string) {
    setSelectedShops((prev) =>
      prev.includes(shopId) ? prev.filter((s) => s !== shopId) : [...prev, shopId]
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-stone-200 border-t-mid-gold animate-spin" />
        <p className="text-sm text-stone-400">Loading your room…</p>
      </div>
    );
  }

  const hasDimensions =
    project.roomLengthMm != null &&
    project.roomWidthMm != null &&
    project.ceilingHeightMm != null;

  const hasWallMapping = !project.floorPlanKey || (() => {
    const rf = project.roomFeatures as RoomFeatures | null;
    if (!rf) return false;
    const roles: WallRole[] = ["entrance", "far", "left", "right"];
    return (
      rf.walls.entrance.features.some((f) => f.type === "door") &&
      roles.some((r) => rf.walls[r].features.some((f) => f.type === "window"))
    );
  })();

  async function saveFeatures(features: RoomFeatures) {
    setSavingFeatures(true);
    try {
      const { project: p } = await api.saveFeatures(id, features);
      setProject(p);
    } catch {
      // mapper UI shows its own completion state
    } finally {
      setSavingFeatures(false);
    }
  }

  // ── Onboarding questionnaire ───────────────────────────────────────────────

  if (!setupComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            All rooms
          </button>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1B4965" }}>{project.name}</h1>
          <p className="text-stone-500 mt-1 text-sm">Let's set up your room so we can show you the right furniture.</p>
        </div>

        <div className="space-y-6">
          {/* Budget */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="font-semibold text-stone-900 mb-1">What's your budget for this room?</h2>
            <p className="text-xs text-stone-400 mb-4">We'll filter furniture to fit what you can afford.</p>
            <div className="grid grid-cols-2 gap-3">
              {BUDGET_OPTIONS.map((opt) => {
                const active = budgetBracket?.label === opt.label;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setBudgetBracket(opt)}
                    className="rounded-xl border-2 px-4 py-3 text-sm font-medium text-left transition-all"
                    style={active
                      ? { borderColor: "#1B4965", background: "#e8f0f5", color: "#1B4965" }
                      : undefined
                    }
                  >
                    <span className={active ? "" : "text-stone-700"}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Preferred shops */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-stone-900 mb-0.5">Which shops do you like to buy from?</h2>
                <p className="text-xs text-stone-400">All are selected by default — deselect any you don't want.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setSelectedShops(SHOPS.map((s) => s.id))}
                  className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 transition-colors"
                >
                  All
                </button>
                <span className="text-stone-300 text-xs">·</span>
                <button
                  onClick={() => setSelectedShops([])}
                  className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SHOPS.map((shop) => {
                const active = selectedShops.includes(shop.id);
                return (
                  <button
                    key={shop.id}
                    onClick={() => toggleShop(shop.id)}
                    className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-all"
                    style={active
                      ? { borderColor: "#1B4965", background: "#e8f0f5", color: "#1B4965" }
                      : undefined
                    }
                  >
                    <span className="flex-shrink-0">
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center border transition-colors inline-flex"
                        style={active
                          ? { background: "#1B4965", borderColor: "#1B4965" }
                          : { borderColor: "#d6d3d1" }
                        }
                      >
                        {active && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </span>
                    </span>
                    <span className={active ? "" : "text-stone-500"}>{shop.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Design style */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="font-semibold text-stone-900 mb-1">What's your design style?</h2>
            <p className="text-xs text-stone-400 mb-4">Choose the look that speaks to you most.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DESIGN_STYLES.map((s) => {
                const active = selectedStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    className="text-left rounded-xl border-2 overflow-hidden transition-all"
                    style={active
                      ? { borderColor: "#1B4965", outline: "2px solid #e8f0f5", outlineOffset: "1px" }
                      : { borderColor: "#e7e5e4" }
                    }
                  >
                    <div
                      className="h-14"
                      style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}
                    />
                    <div className="p-2.5">
                      <p className="font-semibold text-stone-900 text-xs leading-snug">{s.label}</p>
                      <p className="text-stone-400 text-xs mt-0.5 leading-snug hidden sm:block">{s.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Wall colour */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="font-semibold text-stone-900 mb-1">What colour would you like for the walls?</h2>
            <p className="text-xs text-stone-400 mb-4">This will be included in your AI render.</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {WALL_COLORS.map((w) => {
                const active = selectedWallColor === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWallColor(w.id)}
                    className="text-left rounded-xl border-2 overflow-hidden transition-all"
                    style={active
                      ? { borderColor: "#1B4965", outline: "2px solid #e8f0f5", outlineOffset: "1px" }
                      : { borderColor: "#e7e5e4" }
                    }
                  >
                    {w.swatch ? (
                      <div className="h-10" style={{ background: w.swatch, borderBottom: w.id === "neutral" ? "1px solid #e7e5e4" : undefined }} />
                    ) : (
                      <div className="h-10 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f9c0c0, #c0d4f9, #c0f9d4, #f9eec0)" }}>
                        <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                        </svg>
                      </div>
                    )}
                    <div className="p-2">
                      <p className="font-semibold text-stone-900 text-xs leading-snug">{w.label}</p>
                      <p className="text-stone-400 text-xs mt-0.5 leading-snug hidden sm:block">{w.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedWallColor === "custom" && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-stone-500 mb-1.5">Describe your wall colour</label>
                <input
                  type="text"
                  placeholder="e.g. sage green, dusty pink, deep navy…"
                  value={customWallColor}
                  onChange={(e) => setCustomWallColor(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent placeholder:text-stone-400"
                  autoFocus
                />
              </div>
            )}
          </section>

          {/* Flooring */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="font-semibold text-stone-900 mb-1">What type of flooring would you prefer?</h2>
            <p className="text-xs text-stone-400 mb-4">Sets the floor finish in your AI render.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {FLOORING_TYPES.map((f) => {
                const active = selectedFlooring === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFlooring(f.id)}
                    className="text-left rounded-xl border-2 overflow-hidden transition-all"
                    style={active
                      ? { borderColor: "#1B4965", outline: "2px solid #e8f0f5", outlineOffset: "1px" }
                      : { borderColor: "#e7e5e4" }
                    }
                  >
                    <div className="h-10" style={{ background: f.swatch }} />
                    <div className="p-2">
                      <p className="font-semibold text-stone-900 text-xs leading-snug">{f.label}</p>
                      <p className="text-stone-400 text-xs mt-0.5 leading-snug hidden sm:block">{f.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Submit */}
          {setupError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {setupError}
            </p>
          )}
          <button
            onClick={submitSetup}
            disabled={submittingSetup}
            className="w-full disabled:opacity-40 rounded-xl py-3 font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
            style={{ background: "#D4A574", color: "#1B4965" }}
          >
            {submittingSetup ? "Saving your preferences…" : "Let's start designing →"}
          </button>
        </div>
      </div>
    );
  }

  // ── Normal workflow ────────────────────────────────────────────────────────

  const steps = [
    { n: 1, label: "Room size",    done: hasDimensions },
    { n: 2, label: "Floor plan",   done: hasDimensions },
    { n: 3, label: "Wall mapping", done: hasWallMapping },
    { n: 4, label: "Furniture",    done: furnitureMode === "auto" || selectedProducts.size > 0 },
    { n: 5, label: "Generate",     done: project.renders.length > 0 },
  ];
  const currentStep = steps.find((s) => !s.done)?.n ?? 5;

  const selectedProductObjects = [...selectedProductsData.values()];
  const totalCost = selectedProductObjects.reduce((sum, p) => sum + (p.priceGbp ?? 0), 0);

  const budgetLabel = BUDGET_OPTIONS.find(
    (b) => b.min === project.budgetMin && b.max === project.budgetMax
  )?.label;
  const styleLabel = DESIGN_STYLES.find((s) => s.id === project.designStyle)?.label;
  const wallLabel = project.wallColorPalette
    ? (WALL_COLORS.find((w) => w.id === project.wallColorPalette)?.label ?? project.wallColorPalette)
    : null;
  const floorLabel = project.flooringType
    ? (FLOORING_TYPES.find((f) => f.id === project.flooringType)?.label ?? project.flooringType)
    : null;
  const wallSwatch = project.wallColorPalette
    ? (WALL_COLORS.find((w) => w.id === project.wallColorPalette)?.swatch ?? null)
    : null;
  const floorSwatch = project.flooringType
    ? (FLOORING_TYPES.find((f) => f.id === project.flooringType)?.swatch ?? null)
    : null;

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div>
        <button
          onClick={() => router.push("/projects")}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          All rooms
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1B4965" }}>{project.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {budgetLabel && (
              <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                {budgetLabel}
              </span>
            )}
            {styleLabel && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium border"
                style={{ background: "#e8f0f5", color: "#1B4965", borderColor: "#AECFDB" }}
              >
                {styleLabel}
              </span>
            )}
            {wallLabel && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                {wallSwatch && <span className="w-3 h-3 rounded-full border border-stone-300 flex-shrink-0" style={{ background: wallSwatch }} />}
                {wallLabel} walls
              </span>
            )}
            {floorLabel && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
                {floorSwatch && <span className="w-3 h-3 rounded-full border border-stone-300 flex-shrink-0" style={{ background: floorSwatch }} />}
                {floorLabel}
              </span>
            )}
            {!editingPrefs && (
              <button
                onClick={() => setEditingPrefs(true)}
                className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit preferences panel */}
      {editingPrefs && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900">Edit preferences</h2>
            <button
              onClick={() => {
                const match = BUDGET_OPTIONS.find((b) => b.min === project.budgetMin && b.max === project.budgetMax);
                setBudgetBracket(match ?? null);
                setSelectedShops(project.preferredRetailers.length ? project.preferredRetailers : SHOPS.map((s) => s.id));
                setSelectedStyle(project.designStyle);
                if (project.wallColorPalette) {
                  const known = WALL_COLORS.find((w) => w.id === project.wallColorPalette);
                  if (known) { setSelectedWallColor(project.wallColorPalette); setCustomWallColor(""); }
                  else { setSelectedWallColor("custom"); setCustomWallColor(project.wallColorPalette); }
                } else { setSelectedWallColor(null); setCustomWallColor(""); }
                setSelectedFlooring(project.flooringType);
                setSetupError("");
                setEditingPrefs(false);
              }}
              className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Budget */}
          <div>
            <p className="text-sm font-semibold text-stone-700 mb-3">Budget</p>
            <div className="grid grid-cols-2 gap-2">
              {BUDGET_OPTIONS.map((opt) => {
                const active = budgetBracket?.label === opt.label;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setBudgetBracket(opt)}
                    className="rounded-xl border-2 px-4 py-2.5 text-sm font-medium text-left transition-all"
                    style={active
                      ? { borderColor: "#1B4965", background: "#e8f0f5", color: "#1B4965" }
                      : undefined
                    }
                  >
                    <span className={active ? "" : "text-stone-700"}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred shops */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-stone-700">Preferred shops</p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedShops(SHOPS.map((s) => s.id))} className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 transition-colors">All</button>
                <span className="text-stone-300 text-xs">·</span>
                <button onClick={() => setSelectedShops([])} className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 transition-colors">None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SHOPS.map((shop) => {
                const active = selectedShops.includes(shop.id);
                return (
                  <button
                    key={shop.id}
                    onClick={() => toggleShop(shop.id)}
                    className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium text-left transition-all"
                    style={active
                      ? { borderColor: "#1B4965", background: "#e8f0f5", color: "#1B4965" }
                      : undefined
                    }
                  >
                    <span
                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors"
                      style={active
                        ? { background: "#1B4965", borderColor: "#1B4965" }
                        : { borderColor: "#d6d3d1" }
                      }
                    >
                      {active && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    <span className={active ? "" : "text-stone-500"}>{shop.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Design style */}
          <div>
            <p className="text-sm font-semibold text-stone-700 mb-3">Design style</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DESIGN_STYLES.map((s) => {
                const active = selectedStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(s.id)}
                    className="text-left rounded-xl border-2 overflow-hidden transition-all"
                    style={active
                      ? { borderColor: "#1B4965", outline: "2px solid #e8f0f5", outlineOffset: "1px" }
                      : { borderColor: "#e7e5e4" }
                    }
                  >
                    <div className="h-12" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }} />
                    <div className="p-2">
                      <p className="font-semibold text-stone-900 text-xs leading-snug">{s.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wall colour */}
          <div>
            <p className="text-sm font-semibold text-stone-700 mb-3">Wall colour</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {WALL_COLORS.map((w) => {
                const active = selectedWallColor === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWallColor(w.id)}
                    className="text-left rounded-xl border-2 overflow-hidden transition-all"
                    style={active
                      ? { borderColor: "#1B4965", outline: "2px solid #e8f0f5", outlineOffset: "1px" }
                      : { borderColor: "#e7e5e4" }
                    }
                  >
                    {w.swatch ? (
                      <div className="h-8" style={{ background: w.swatch, borderBottom: w.id === "neutral" ? "1px solid #e7e5e4" : undefined }} />
                    ) : (
                      <div className="h-8 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f9c0c0, #c0d4f9, #c0f9d4, #f9eec0)" }}>
                        <svg className="w-3 h-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                        </svg>
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="font-semibold text-stone-900 text-xs leading-snug">{w.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedWallColor === "custom" && (
              <input
                type="text"
                placeholder="e.g. sage green, dusty pink…"
                value={customWallColor}
                onChange={(e) => setCustomWallColor(e.target.value)}
                className="mt-3 w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent placeholder:text-stone-400"
              />
            )}
          </div>

          {/* Flooring */}
          <div>
            <p className="text-sm font-semibold text-stone-700 mb-3">Flooring</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {FLOORING_TYPES.map((f) => {
                const active = selectedFlooring === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFlooring(f.id)}
                    className="text-left rounded-xl border-2 overflow-hidden transition-all"
                    style={active
                      ? { borderColor: "#1B4965", outline: "2px solid #e8f0f5", outlineOffset: "1px" }
                      : { borderColor: "#e7e5e4" }
                    }
                  >
                    <div className="h-8" style={{ background: f.swatch }} />
                    <div className="p-1.5">
                      <p className="font-semibold text-stone-900 text-xs leading-snug">{f.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {setupError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{setupError}</p>
          )}
          <button
            onClick={submitSetup}
            disabled={submittingSetup}
            className="w-full disabled:opacity-40 rounded-xl py-2.5 font-semibold text-sm transition-all hover:bg-mid-gold-dark active:scale-95"
            style={{ background: "#D4A574", color: "#1B4965" }}
          >
            {submittingSetup ? "Saving…" : "Save preferences"}
          </button>
        </div>
      )}

      {/* Step progress */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center">
          {steps.map((step, i) => (
            <div key={step.n} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
                  style={
                    step.done
                      ? { background: "#D4A574", color: "#1B4965" }
                      : step.n === currentStep
                      ? { background: "#1B4965", color: "#ffffff" }
                      : { background: "#f5f5f4", color: "#a8a29e" }
                  }
                >
                  {step.done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : step.n}
                </div>
                <span
                  className="text-xs font-medium hidden sm:block whitespace-nowrap"
                  style={
                    step.done
                      ? { color: "#C4935F" }
                      : step.n === currentStep
                      ? { color: "#1B4965" }
                      : { color: "#a8a29e" }
                  }
                >
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="flex-1 h-px mx-3"
                  style={{ background: step.done ? "#f0ddc4" : "#e7e5e4" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Step 1: Room dimensions ── */}
      <section className={`bg-white rounded-2xl border shadow-sm p-6 ${currentStep === 1 ? "border-stone-300" : "border-stone-200"}`}>
        <div className="flex items-center gap-3 mb-5">
          <StepBadge n={1} done={hasDimensions} current={currentStep === 1} />
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Step 1 of 4</p>
            <h2 className="font-semibold text-stone-900">Room dimensions</h2>
          </div>
        </div>
        <form onSubmit={saveDimensions} className="grid sm:grid-cols-3 gap-4">
          {[
            { label: "Length (m)", val: length, set: setLength, placeholder: "e.g. 4.5" },
            { label: "Width (m)", val: width, set: setWidth, placeholder: "e.g. 3.2" },
            { label: "Ceiling height (m)", val: ceiling, set: setCeiling, placeholder: "e.g. 2.4" },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">{label}</label>
              <input
                type="number" step="0.01" min="0.1" required
                value={val} placeholder={placeholder}
                onChange={(e) => set(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent"
              />
            </div>
          ))}
          <div className="sm:col-span-3 flex items-center gap-3 flex-wrap">
            <button
              type="submit" disabled={savingDims}
              className="disabled:opacity-40 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
              style={{ background: "#D4A574", color: "#1B4965" }}
            >
              {savingDims ? "Saving…" : hasDimensions ? "Update dimensions" : "Save dimensions"}
            </button>
            {hasDimensions && !savingDims && (
              <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#C4935F" }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Saved
              </span>
            )}
            {dimsError && <p className="text-sm text-red-600">{dimsError}</p>}
          </div>
        </form>
        {hasDimensions && currentStep === 2 && (
          <p className="text-xs text-stone-400 mt-4">Next: optionally upload your floor plan ↓</p>
        )}
      </section>

      {/* ── Step 2: Floor plan ── */}
      <section className={`bg-white rounded-2xl border shadow-sm p-6 ${currentStep === 2 ? "border-stone-300" : "border-stone-200"}`}>
        <div className="flex items-center gap-3 mb-5">
          <StepBadge n={2} done={!!project.floorPlanKey} current={currentStep === 2} />
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Step 2 of 4</p>
            <h2 className="font-semibold text-stone-900">Floor plan <span className="text-stone-400 font-normal text-sm">(optional)</span></h2>
          </div>
        </div>
        {uploadingFloor ? (
          <div className="mb-4 border-2 border-dashed border-stone-200 rounded-xl p-8 text-center">
            <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-mid-gold animate-spin mx-auto mb-3" />
            <p className="text-sm text-stone-400">Uploading…</p>
          </div>
        ) : (project.floorPlanUrl || project.floorPlanKey) ? (
          <div className="mb-4">
            {floorImgError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Floor plan saved but couldn&apos;t display preview</p>
                  <p className="text-xs text-amber-600 mt-0.5">File is stored — re-upload or check browser console for details.</p>
                </div>
              </div>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(() => {
                    const raw = project.floorPlanUrl ?? `/uploads/${project.floorPlanKey}`;
                    return raw.startsWith("http") ? raw : `${API_BASE}${raw}`;
                  })()}
                  alt="Floor plan"
                  onError={() => setFloorImgError(true)}
                  className="rounded-xl max-h-64 max-w-full object-contain border border-stone-200 block"
                />
                {(uploadedFileName || project.floorPlanKey) && (
                  <p className="text-xs text-stone-400 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#C4935F" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {uploadedFileName ?? project.floorPlanKey?.split("/").pop() ?? "floor-plan.webp"}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mb-4 border-2 border-dashed border-stone-200 rounded-xl p-8 text-center">
            <svg className="w-8 h-8 text-stone-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm text-stone-500 mb-1">Upload your floor plan for a more personalised design</p>
            <p className="text-xs text-stone-400">JPEG, PNG or WebP — a photo of a hand-drawn plan works great</p>
          </div>
        )}
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFloorPlan(f); }}
        />
        <button
          onClick={() => fileRef.current?.click()} disabled={uploadingFloor}
          className="bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 disabled:opacity-50 text-stone-700 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        >
          {project.floorPlanKey ? "Change image" : "Upload floor plan (optional)"}
        </button>
        {floorError && <p className="text-sm text-red-600 mt-2">{floorError}</p>}
        {currentStep === 3 && (
          <p className="text-xs text-stone-400 mt-4">Next: map your room walls below ↓</p>
        )}
      </section>

      {/* ── Step 3: Wall mapping ── */}
      <section className={`bg-white rounded-2xl border shadow-sm p-6 ${currentStep === 3 ? "border-stone-300" : "border-stone-200"}`}>
        <div className="flex items-center gap-3 mb-5">
          <StepBadge n={3} done={hasWallMapping} current={currentStep === 3} />
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Step 3 of 5</p>
            <h2 className="font-semibold text-stone-900">
              Map your walls{" "}
              <span className="text-stone-400 font-normal text-sm">
                {!project.floorPlanKey ? "(upload floor plan first)" : "(optional)"}
              </span>
            </h2>
          </div>
        </div>
        {!project.floorPlanKey ? (
          <p className="text-sm text-stone-400">
            Upload your floor plan in Step 2 to mark wall features — door position, windows, and fireplace.
            This helps us position furniture correctly and choose the best camera angle.
          </p>
        ) : hasWallMapping && !editingFeatures ? (
          <RoomSummary
            features={project.roomFeatures as RoomFeatures}
            roomLengthMm={project.roomLengthMm}
            roomWidthMm={project.roomWidthMm}
            onEdit={() => setEditingFeatures(true)}
            onContinue={() => document.getElementById("step-furniture")?.scrollIntoView({ behavior: "smooth" })}
          />
        ) : (
          <FloorPlanMapper
            floorPlanUrl={project.floorPlanUrl ?? ""}
            initialFeatures={project.roomFeatures}
            saving={savingFeatures}
            onSave={async (features) => {
              await saveFeatures(features);
              setEditingFeatures(false);
            }}
          />
        )}
        {hasWallMapping && currentStep === 4 && (
          <p className="text-xs text-stone-400 mt-4">Next: choose your furniture below ↓</p>
        )}
      </section>

      {/* ── Step 4: Furniture ── */}
      <section id="step-furniture" className={`bg-white rounded-2xl border shadow-sm p-6 ${currentStep === 4 ? "border-stone-300" : "border-stone-200"}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <StepBadge n={4} done={furnitureMode === "auto" || selectedProducts.size > 0} current={currentStep === 4} />
            <div>
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Step 4 of 5</p>
              <h2 className="font-semibold text-stone-900">Furniture</h2>
            </div>
          </div>
          {furnitureMode === "manual" && selectedProducts.size > 0 && (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{ background: "#e8f0f5", color: "#1B4965", borderColor: "#AECFDB" }}
            >
              {selectedProducts.size}/12 selected
            </span>
          )}
        </div>

        {furnitureMode === "auto" ? (
          /* ── Auto mode ── */
          <div>
            <div className="bg-stone-50 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-stone-700 mb-2">AI will select furniture for you</p>
              <div className="flex flex-wrap gap-2">
                {budgetLabel && (
                  <span className="text-xs bg-white border border-stone-200 text-stone-600 px-2.5 py-1 rounded-full">
                    {budgetLabel}
                  </span>
                )}
                {styleLabel && (
                  <span className="text-xs bg-white border border-stone-200 text-stone-600 px-2.5 py-1 rounded-full">
                    {styleLabel}
                  </span>
                )}
                {project.preferredRetailers.length > 0 && (
                  <span className="text-xs bg-white border border-stone-200 text-stone-600 px-2.5 py-1 rounded-full">
                    {project.preferredRetailers.map((r) => SHOPS.find((s) => s.id === r)?.label ?? r).join(", ")}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setFurnitureMode("manual")}
              className="text-sm text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors"
            >
              I want to pick specific items instead
            </button>
          </div>
        ) : (
          /* ── Manual mode ── */
          <div>
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setFurnitureMode("auto")}
                className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Let AI choose instead
              </button>
              {(project.preferredRetailers.length > 0 || project.budgetMax != null) && (
                <div className="flex flex-wrap gap-1.5">
                  {project.preferredRetailers.length > 0 && (
                    <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                      {project.preferredRetailers.map((r) => SHOPS.find((s) => s.id === r)?.label ?? r).join(", ")}
                    </span>
                  )}
                  {project.budgetMax != null && (
                    <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                      Under £{project.budgetMax.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            <input
              type="search"
              placeholder="Search sofas, tables, beds…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent placeholder:text-stone-400"
            />
            {productsLoading ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-stone-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : productList.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <p className="text-sm">No products found matching your preferences.</p>
                <p className="text-xs mt-1">Try a different search term.</p>
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {productList.map((p) => {
                  const selected = selectedProducts.has(p.id);
                  const atMax = selectedProducts.size >= 12 && !selected;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => !atMax && toggleProduct(p.id)}
                        disabled={atMax}
                        className="w-full text-left rounded-xl border px-3 py-2.5 text-sm transition-all disabled:opacity-40"
                        style={selected
                          ? { borderColor: "#1B4965", background: "#e8f0f5", outline: "1px solid #2A5F7F" }
                          : undefined
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-stone-900 truncate">{p.title}</p>
                          {selected && (
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#C4935F" }}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">
                          <span className="capitalize">{p.retailer.replace("_", " ")}</span>
                          {p.priceGbp != null && (
                            <span className="font-medium text-stone-600"> · £{p.priceGbp}</span>
                          )}
                          {p.dimensionsRaw ? ` · ${p.dimensionsRaw}` : ""}
                        </p>
                        {p.fitResult?.fits === "perfect" && (
                          <p className="text-xs mt-1 text-green-600 font-medium">✅ {p.fitResult.message}</p>
                        )}
                        {p.fitResult?.fits === "tight" && (
                          <p className="text-xs mt-1 text-amber-600 font-medium">⚠️ {p.fitResult.message}</p>
                        )}
                        {p.fitResult?.fits === "too_large" && (
                          <p className="text-xs mt-1 text-red-500 font-medium">❌ {p.fitResult.message}</p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Selected furniture summary */}
            {selectedProductObjects.length > 0 && (
              <div className="mt-5 border-t border-stone-100 pt-5">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Your selection</p>
                <ul className="space-y-2.5">
                  {selectedProductObjects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm gap-3">
                      <span className="text-stone-700 truncate">{p.title}</span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {p.priceGbp != null && (
                          <span className="font-medium text-stone-900">£{p.priceGbp}</span>
                        )}
                        {p.productUrl && (
                          <ProductLink
                            id={p.id}
                            href={p.affiliateUrl ?? p.productUrl}
                            onClick={() => {}}
                            className="text-xs font-medium hover:underline transition-colors"
                            style={{ color: "#1B4965" }}
                          >
                            Shop →
                          </ProductLink>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-700">Estimated total</span>
                  <span className="text-xl font-bold text-stone-900">£{totalCost.toFixed(0)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {(furnitureMode === "auto" || selectedProducts.size > 0) && currentStep === 5 && (
          <p className="text-xs text-stone-400 mt-4">Next: describe your style and generate your design below ↓</p>
        )}
      </section>

      {/* ── Step 5: Generate render ── */}
      <section className={`bg-white rounded-2xl border shadow-sm p-6 ${currentStep === 5 ? "border-stone-300" : "border-stone-200"}`}>
        <div className="flex items-center gap-3 mb-5">
          <StepBadge n={5} done={project.renders.length > 0} current={currentStep === 5} />
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Step 5 of 5</p>
            <h2 className="font-semibold text-stone-900">Generate your design</h2>
          </div>
        </div>
        <form onSubmit={generateRender} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Describe your style</label>
            <textarea
              required rows={3}
              placeholder={styleLabel ? `e.g. ${styleLabel} living room, warm afternoon light, cream walls` : "e.g. Scandi minimalist, warm afternoon light, cream walls and oak accents"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent resize-none placeholder:text-stone-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={rendering || !hasDimensions || renderError === "FREE_LIMIT_REACHED"}
              className="disabled:opacity-40 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all hover:bg-mid-gold-dark active:scale-95"
              style={{ background: "#D4A574", color: "#1B4965" }}
            >
              {rendering ? "Generating your design…" : "Generate design →"}
            </button>
            {!hasDimensions && (
              <p className="text-xs text-stone-400">Set your room dimensions first</p>
            )}
            {renderError && renderError !== "FREE_LIMIT_REACHED" && (
              <p className="text-sm text-red-600">{renderError}</p>
            )}
          </div>

          {renderError === "FREE_LIMIT_REACHED" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-800">You&apos;ve reached your monthly render limit.</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Premium tier coming soon —{" "}
                <a href="mailto:hello@myinteriordesigner.co.uk?subject=Premium waitlist" className="underline font-medium">
                  join the waitlist
                </a>{" "}
                to be first to know.
              </p>
            </div>
          ) : usageData && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-stone-400">
                  {usageData.usedThisMonth} of {usageData.freeLimit} renders used this month
                </span>
                {usageData.remaining !== null && usageData.remaining <= 10 && (
                  <span className="text-xs font-medium text-amber-600">{usageData.remaining} remaining</span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (usageData.usedThisMonth / usageData.freeLimit) * 100)}%`,
                    background: usageData.remaining !== null && usageData.remaining <= 10 ? "#D97706" : "#D4A574",
                  }}
                />
              </div>
            </div>
          )}
        </form>
      </section>

      {/* ── Renders gallery ── */}
      {project.renders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900">Your designs</h2>
            <span className="text-xs text-stone-400">
              {project.renders.length} render{project.renders.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {project.renders.map((r) => (
              <RenderCard
                key={r.id}
                render={r}
                onDelete={async () => {
                  await api.deleteRender(id, r.id);
                  setProject((p) =>
                    p ? { ...p, renders: p.renders.filter((x) => x.id !== r.id) } : p
                  );
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBadge({ n, done, current }: { n: number; done: boolean; current: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 transition-colors"
      style={
        done
          ? { background: "#D4A574", color: "#1B4965" }
          : current
          ? { background: "#1B4965", color: "#ffffff" }
          : { background: "#f5f5f4", color: "#a8a29e" }
      }
    >
      {done ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : n}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

function RenderCard({ render, onDelete }: { render: Render; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete(); }
    catch { setDeleting(false); setConfirming(false); }
  }

  const imgSrc = render.imageUrl
    ? render.imageUrl.startsWith("http") ? render.imageUrl : `${API_BASE}${render.imageUrl}`
    : null;

  const products = render.products ?? [];
  const hasProducts = render.status === "done" && products.length > 0;
  const total = products.reduce((s, p) => s + (p.priceGbp ?? 0), 0);
  const hasTotal = products.some((p) => p.priceGbp != null);

  return (
    <div id={`render-${render.id}`} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      {imgSrc && render.status === "done" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt="Room design" className="w-full h-72 object-cover" />
      )}
      {render.status === "pending" && (
        <div className="w-full h-72 bg-stone-50 flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-mid-gold animate-spin" />
          <p className="text-sm text-stone-400">Generating your design…</p>
        </div>
      )}
      {render.status === "failed" && !imgSrc && (
        <div className="w-full h-20 bg-red-50 flex items-center justify-center">
          <p className="text-xs text-red-400">Render failed</p>
        </div>
      )}
      <div className="p-5">
        <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">{render.prompt}</p>
        {render.status === "failed" && (
          <p className="text-xs text-red-500 mt-1.5">{render.errorMessage}</p>
        )}
        {render.errorMessage && render.status === "done" && (
          <p className="text-xs text-amber-500 mt-1.5">{render.errorMessage}</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {render.status === "done" && imgSrc && (
              <a href={imgSrc} target="_blank" rel="noopener noreferrer"
                className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                View full size
              </a>
            )}
            {render.status === "done" && (
              <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#C4935F" }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Ready
              </span>
            )}
          </div>
          {confirming ? (
            <span className="flex items-center gap-3 text-xs">
              <span className="text-stone-500">Delete this design?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setConfirming(false)} disabled={deleting}
                className="text-stone-400 hover:text-stone-600 disabled:opacity-50">
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} title="Delete design"
              className="text-stone-300 hover:text-red-400 transition-colors">
              <TrashIcon />
            </button>
          )}
        </div>

        {hasProducts && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#062C3D" }}>
              Furniture &amp; Decor Selections
            </h3>
            <ul className="space-y-3">
              {products.map((p) => (
                <FurnitureRow key={p.id} product={p} />
              ))}
            </ul>
            {hasTotal && (
              <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total</span>
                <span className="text-base font-bold" style={{ color: "#D4A574" }}>
                  £{total.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FurnitureRow({ product: p }: { product: RenderProduct }) {
  return (
    <li className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.imageUrl}
        alt={p.title}
        className="w-12 h-12 object-cover rounded-lg border border-stone-100 flex-shrink-0 bg-stone-50"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-stone-800 leading-snug line-clamp-2">{p.title}</p>
        <p className="text-xs text-stone-400 mt-0.5 capitalize">{p.retailer.replace(/_/g, " ")}</p>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {p.priceGbp != null && (
          <span className="text-sm font-semibold text-stone-700">£{p.priceGbp.toFixed(0)}</span>
        )}
        <ProductLink
          id={p.id}
          href={p.affiliateUrl ?? p.productUrl}
          className="text-xs font-medium hover:underline transition-colors"
          style={{ color: "#062C3D" }}
        >
          Shop →
        </ProductLink>
      </div>
    </li>
  );
}
