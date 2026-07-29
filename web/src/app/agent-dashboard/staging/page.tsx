"use client";
import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { agents, ApiError, getAgentToken, clearAgentToken, type StagingResult } from "@/lib/api";
import { config } from "@/config";

// ── Loading steps ──────────────────────────────────────────────────────────────

const LOADING_STEPS_EMPTY = [
  { step: 1, label: "Analysing your room",          sublabel: "Understanding the space, light and dimensions…", duration: 5000 },
  { step: 2, label: "Staging your room",            sublabel: "Adding furniture and soft furnishings…",          duration: 15000 },
] as const;

const LOADING_STEPS_FURNISHED = [
  { step: 1, label: "Removing existing furniture",  sublabel: "Clearing the room of all furnishings…",          duration: 12000 },
  { step: 2, label: "Analysing the empty space",    sublabel: "Understanding light, proportions and features…",  duration: 5000 },
  { step: 3, label: "Staging fresh from scratch",   sublabel: "Placing furniture in optimal positions…",         duration: 15000 },
] as const;

// ── Brief inspiration chips ────────────────────────────────────────────────────

const INSPIRATIONS = [
  { id: "agent_edwardian_traditional", label: "Edwardian traditional",  text: "Stage this room with traditional furniture in keeping with an Edwardian house. Add period-appropriate art on the walls, fresh plants, and warm lighting." },
  { id: "agent_modern_minimalist",     label: "Modern minimalist",      text: "Stage this room with clean, contemporary minimalist furniture. Neutral palette, statement lighting, a few carefully chosen decorative objects." },
  { id: "agent_cosy_family",           label: "Cosy family home",       text: "Stage this as a warm, welcoming family living space. Comfortable sofas, soft furnishings, bookshelves, plants and family-friendly styling." },
  { id: "agent_luxury_contemporary",   label: "Luxury contemporary",    text: "Stage this room to feel high-end and aspirational. Luxurious materials, statement furniture, bold artwork, carefully curated accessories." },
  { id: "agent_scandi_minimalist",     label: "Scandi minimalist",      text: "Stage this with Scandinavian minimalist furniture — pale woods, clean lines, natural textures, neutral colours, and simple greenery." },
  { id: "agent_country_house",         label: "Country house",          text: "Stage this as an elegant country house interior. Antique and vintage pieces, floral accents, warm colours, bookshelves and countryside charm." },
];

// ── Room state selector ────────────────────────────────────────────────────────

function RoomStateSelector({ onSelect }: { onSelect: (furnished: boolean) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
      <div>
        <p className="text-sm font-semibold text-stone-800">What is the current state of the room?</p>
        <p className="text-xs text-stone-400 mt-0.5">This helps us choose the right approach</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Empty room */}
        <button
          type="button"
          onClick={() => onSelect(false)}
          className="text-left rounded-xl border-2 p-4 transition-all hover:border-[#062C3D] hover:shadow-sm group"
          style={{ borderColor: "#E7E5E0" }}
        >
          <div className="text-2xl mb-2">🏠</div>
          <p className="text-sm font-semibold text-stone-800 mb-1">Empty room</p>
          <p className="text-xs text-stone-500 leading-relaxed mb-3">
            The room has no furniture — ready to stage directly
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(6,44,61,0.07)", color: "#062C3D" }}>
            ⚡ ~20 seconds
          </span>
        </button>

        {/* Furnished room */}
        <button
          type="button"
          onClick={() => onSelect(true)}
          className="text-left rounded-xl border-2 p-4 transition-all hover:border-[#062C3D] hover:shadow-sm group"
          style={{ borderColor: "#E7E5E0" }}
        >
          <div className="text-2xl mb-2">🛋️</div>
          <p className="text-sm font-semibold text-stone-800 mb-1">Furnished room</p>
          <p className="text-xs text-stone-500 leading-relaxed mb-3">
            Remove existing furniture first, then stage from scratch
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(212,165,116,0.12)", color: "#9A6B3A" }}>
            ✨ ~40 seconds
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Before/after slider ────────────────────────────────────────────────────────

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  function onMove(clientX: number) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }

  return (
    <div
      ref={ref}
      className="relative w-full aspect-video rounded-xl overflow-hidden cursor-col-resize select-none"
      onMouseMove={(e) => { if (e.buttons === 1) onMove(e.clientX); }}
      onTouchMove={(e) => { const t = e.touches[0]; if (t) onMove(t.clientX); }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      </div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-stone-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3M16 9l4 3-4 3" />
          </svg>
        </div>
      </div>
      <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">Before</span>
      <span className="absolute bottom-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ left: `${pos + 1}%`, background: "#D4A574", color: "#1B3050" }}>After ✨</span>
    </div>
  );
}

// ── Result card ────────────────────────────────────────────────────────────────

function ResultCard({
  result, brief, isFurnished, originalUrl,
}: {
  result: StagingResult; brief: string; isFurnished: boolean; originalUrl: string;
}) {
  const resolve = (url: string) =>
    url.startsWith("http") ? url : `${config.apiUrl}${url}`;

  const stagedUrl   = resolve(result.imageUrl);
  const emptyUrl    = result.emptyRoomUrl ? resolve(result.emptyRoomUrl) : null;
  const originalSrc = originalUrl;

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">

      {/* Transformation journey (furnished rooms only) */}
      {isFurnished && emptyUrl && (
        <div className="p-4 border-b border-stone-100">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Transformation journey</p>
          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalSrc} alt="Original" className="w-full aspect-[4/3] object-cover rounded-lg" />
              <p className="text-xs text-center text-stone-400 font-medium">Original</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </div>
            <div className="space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emptyUrl} alt="Cleared" className="w-full aspect-[4/3] object-cover rounded-lg" />
              <p className="text-xs text-center text-stone-400 font-medium">Cleared</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-px bg-stone-100" />
            <svg className="w-5 h-5 text-[#D4A574] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
            </svg>
            <div className="flex-1 h-px bg-stone-100" />
          </div>
          <p className="text-xs text-center text-[#D4A574] font-semibold mt-1">Staged ✨</p>
        </div>
      )}

      {/* Before / after slider */}
      <div className="p-4 space-y-3">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Before / after</p>
        <BeforeAfterSlider before={originalSrc} after={stagedUrl} />
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-3">
        <p className="text-xs text-stone-500 leading-relaxed italic">&ldquo;{brief}&rdquo;</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={stagedUrl}
            download={`mid-staged-${Date.now()}.png`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: "#062C3D", color: "white" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download staged
          </a>
          {emptyUrl && (
            <a
              href={emptyUrl}
              download={`mid-empty-${Date.now()}.png`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border transition-colors"
              style={{ borderColor: "#D0CCC5", color: "#62584E" }}
            >
              Download cleared
            </a>
          )}
          {result.mock && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg self-center">mock render</span>
          )}
        </div>
        <p className="text-[10px] text-stone-400 leading-relaxed">
          For illustrative purposes only. Include a disclaimer in your listing: &ldquo;Computer-generated virtual staging — for illustrative purposes only.&rdquo;
        </p>
      </div>
    </div>
  );
}

// ── Loading panel ──────────────────────────────────────────────────────────────

function LoadingPanel({ step, isFurnished }: { step: number; isFurnished: boolean }) {
  const steps = isFurnished ? LOADING_STEPS_FURNISHED : LOADING_STEPS_EMPTY;
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 space-y-6">
      <div className="w-12 h-12 rounded-full border-2 border-stone-200 border-t-[#D4A574] animate-spin mx-auto" />
      {steps.map((s) => {
        const isActive = step === s.step;
        const isDone   = step > s.step;
        return (
          <div key={s.step} className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 transition-all ${
              isDone   ? "bg-emerald-100 text-emerald-600" :
              isActive ? "bg-[#D4A574] text-white" :
                         "bg-stone-100 text-stone-400"
            }`}>
              {isDone ? "✓" : s.step}
            </div>
            <div>
              <p className={`text-sm font-semibold transition-colors ${isActive ? "text-stone-900" : isDone ? "text-stone-400" : "text-stone-300"}`}>
                {s.label}
              </p>
              {isActive && (
                <p className="text-xs text-stone-400 mt-0.5">{s.sublabel}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentStagingPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getAgentToken()) router.replace("/agent-login");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Room state
  const [isFurnished, setIsFurnished] = useState<boolean | null>(null);

  // Photo state
  const [photo,        setPhoto]        = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brief state
  const [brief, setBrief] = useState("");

  // Generation state
  const [loading,     setLoading]     = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error,       setError]       = useState("");
  const [result,      setResult]      = useState<StagingResult | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function handlePhotoSelect(file: File) {
    setPhoto(file);
    setResult(null);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handlePhotoSelect(file);
  }

  function handleRoomStateSelect(furnished: boolean) {
    setIsFurnished(furnished);
    setResult(null);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!photo || !brief.trim() || isFurnished === null) return;
    setError("");
    setLoading(true);
    setLoadingStep(1);
    setResult(null);

    // Schedule loading step advances
    const steps = isFurnished ? LOADING_STEPS_FURNISHED : LOADING_STEPS_EMPTY;
    let elapsed = 0;
    for (let i = 0; i < steps.length - 1; i++) {
      elapsed += steps[i].duration;
      const nextStep = i + 2;
      const t = setTimeout(() => setLoadingStep(nextStep), elapsed);
      stepTimerRef.current.push(t);
    }

    try {
      const res = await agents.staging(photo, brief.trim(), isFurnished);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAgentToken();
        router.replace("/agent-login");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong — please try again");
      }
    } finally {
      stepTimerRef.current.forEach(clearTimeout);
      stepTimerRef.current = [];
      setLoading(false);
      setLoadingStep(0);
    }
  }

  const canSubmit = !!photo && brief.trim().length > 0 && isFurnished !== null && !loading;

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/MIDLogo.png" alt="My Interior Designer" width={120} height={84} className="h-9 w-auto object-contain" priority />
            <span className="font-semibold text-[#062C3D] tracking-tight hidden sm:block text-sm">Virtual Staging</span>
          </Link>
          <Link href="/agent-dashboard" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
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
          <p className="text-stone-500 text-sm mt-1.5 max-w-xl">
            Upload a photo of the room, describe how you want it staged — we do the rest.
            Works on empty and furnished rooms.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">

          {/* ── Form ──────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
            )}

            {/* Step 1: Room state */}
            <RoomStateSelector onSelect={handleRoomStateSelect} />

            {/* Steps 2–4: only show after room state is chosen */}
            {isFurnished !== null && (
              <>
                {/* Selected state badge + change link */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: "rgba(6,44,61,0.07)", color: "#062C3D" }}>
                    {isFurnished ? "🛋️ Furnished room selected" : "🏠 Empty room selected"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setIsFurnished(null); setPhoto(null); setPhotoPreview(null); setResult(null); }}
                    className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    Change
                  </button>
                </div>

                {/* Photo upload */}
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-stone-800">Room photo</label>
                    {photo && (
                      <button
                        type="button"
                        onClick={() => { setPhoto(null); setPhotoPreview(null); setResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-xs text-stone-400 hover:text-stone-700"
                      >
                        Change photo
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoSelect(f); }}
                  />

                  {photoPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-stone-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Room preview" className="w-full aspect-video object-cover" />
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                        {photo?.name}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors hover:border-[#D4A574]"
                      style={{ borderColor: "#D4E8EE" }}
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="text-3xl mb-3">📷</div>
                      <p className="text-sm font-medium text-stone-700 mb-1">Drop a photo here or click to upload</p>
                      <p className="text-xs text-stone-400">JPEG, PNG or WebP · up to 10 MB</p>
                      {isFurnished
                        ? <p className="text-xs text-stone-400 mt-1">Upload a photo of the furnished room — we will clear it before staging</p>
                        : <p className="text-xs text-stone-400 mt-1">Upload a photo of the empty room taken with your phone or camera</p>
                      }
                    </div>
                  )}
                </div>

                {/* Staging brief */}
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
                  <label className="block text-sm font-semibold text-stone-800">Staging brief</label>

                  <div className="grid grid-cols-3 gap-2">
                    {INSPIRATIONS.map((ins) => {
                      const active = brief === ins.text;
                      return (
                        <button
                          key={ins.id}
                          type="button"
                          onClick={() => setBrief(ins.text)}
                          className="text-left rounded-xl border-2 overflow-hidden transition-all"
                          style={active
                            ? { borderColor: "#D4A574", outline: "2px solid rgba(212,165,116,0.25)", outlineOffset: "1px" }
                            : { borderColor: "#E7E5E0" }}
                        >
                          <div className="relative h-16 bg-stone-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/styles/${ins.id}.jpg`}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                          <p
                            className="text-xs px-2 py-1.5 leading-snug"
                            style={active ? { color: "#062C3D", fontWeight: 600 } : { color: "#6B7280" }}
                          >
                            {ins.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="e.g. Stage this as a warm, welcoming living room in a Victorian terraced house. Use traditional furniture, add art on the walls, plants, and warm lighting."
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none leading-relaxed"
                  />
                  <div className="flex justify-between">
                    <p className="text-xs text-stone-400">Select a style above or write your own brief. The more detail, the better the result.</p>
                    <p className="text-xs text-stone-400">{brief.length}/1000</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full disabled:opacity-40 rounded-xl py-4 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
                  style={{ background: "#062C3D", color: "white" }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      {isFurnished
                        ? loadingStep === 1 ? "Step 1: Clearing furniture…"
                        : loadingStep === 2 ? "Step 2: Analysing space…"
                        : "Step 3: Staging room…"
                        : loadingStep === 1 ? "Step 1: Analysing room…" : "Step 2: Staging room…"
                      }
                    </span>
                  ) : (
                    isFurnished
                      ? "Clear & stage room →"
                      : "Generate virtual staging →"
                  )}
                </button>
              </>
            )}
          </form>

          {/* ── Result / placeholder ─────────────────────────────────── */}
          <div className="space-y-4">
            {result && photoPreview && (
              <ResultCard
                result={result}
                brief={brief}
                isFurnished={!!isFurnished}
                originalUrl={photoPreview}
              />
            )}

            {!result && !loading && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{ background: "#EEF6F8" }}>
                  {isFurnished === true ? "🛋️" : "🏠"}
                </div>
                <p className="text-sm font-semibold text-stone-700 mb-2">Your staged room appears here</p>
                <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
                  {isFurnished === null
                    ? "Select a room state to get started."
                    : isFurnished
                    ? "Upload a photo of the furnished room and write a brief — we will clear it then stage it fresh."
                    : "Upload a photo of the empty room, write a brief, and hit generate."}
                </p>
              </div>
            )}

            {loading && <LoadingPanel step={loadingStep} isFurnished={!!isFurnished} />}

            {/* Tips */}
            {!result && (
              <div className="rounded-2xl p-5 border text-xs text-stone-600 leading-relaxed space-y-2"
                style={{ background: "#EEF6F8", borderColor: "#AECFDB" }}>
                <p className="font-semibold text-stone-800">Tips for best results</p>
                <ul className="space-y-1.5 list-disc list-inside text-stone-500">
                  <li>Use a wide-angle photo that shows the whole room</li>
                  <li>Shoot in daylight with lights off to avoid colour casts</li>
                  {isFurnished
                    ? <li>Furnished rooms work best when the photo is well-lit and clutter-free</li>
                    : <li>Empty rooms work best — remove clutter before photographing</li>
                  }
                  <li>Be specific in your brief: mention the era, key pieces, art, plants</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
