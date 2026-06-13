"use client";
import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { agents, ApiError, getAgentToken, clearAgentToken, type StagingResult } from "@/lib/api";
import { config } from "@/config";

// ── Brief inspiration chips ────────────────────────────────────────────────────
const INSPIRATIONS = [
  { label: "Edwardian traditional",    text: "Stage this room with traditional furniture in keeping with an Edwardian house. Add period-appropriate art on the walls, fresh plants, and warm lighting." },
  { label: "Modern minimalist",        text: "Stage this room with clean, contemporary minimalist furniture. Neutral palette, statement lighting, a few carefully chosen decorative objects." },
  { label: "Cosy family home",         text: "Stage this as a warm, welcoming family living space. Comfortable sofas, soft furnishings, bookshelves, plants and family-friendly styling." },
  { label: "Luxury contemporary",      text: "Stage this room to feel high-end and aspirational. Luxurious materials, statement furniture, bold artwork, carefully curated accessories." },
  { label: "Scandi minimalist",        text: "Stage this with Scandinavian minimalist furniture — pale woods, clean lines, natural textures, neutral colours, and simple greenery." },
  { label: "Country house",            text: "Stage this as an elegant country house interior. Antique and vintage pieces, floral accents, warm colours, bookshelves and countryside charm." },
];

// ── Result card ────────────────────────────────────────────────────────────────
function ResultCard({ result, brief }: { result: StagingResult; brief: string }) {
  const imageUrl = result.imageUrl.startsWith("http")
    ? result.imageUrl
    : `${config.apiUrl}${result.imageUrl}`;

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Virtual staging render" className="w-full aspect-[4/3] object-cover" />
      <div className="p-4 space-y-3">
        <p className="text-xs text-stone-500 leading-relaxed italic">&ldquo;{brief}&rdquo;</p>
        <div className="flex gap-2">
          <a
            href={imageUrl}
            download={`mid-staging-${Date.now()}.png`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
            style={{ background: "#062C3D", color: "white" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
          {result.mock && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">mock render</span>
          )}
        </div>
        <p className="text-[10px] text-stone-400 leading-relaxed">
          For illustrative purposes only. Include a disclaimer in your listing: &ldquo;Computer-generated virtual staging — for illustrative purposes only.&rdquo;
        </p>
      </div>
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

  // Photo state
  const [photo,        setPhoto]        = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brief state
  const [brief, setBrief] = useState("");

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<StagingResult | null>(null);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!photo || !brief.trim()) return;
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await agents.staging(photo, brief.trim());
      setResult(res);
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

  const canSubmit = !!photo && brief.trim().length > 0 && !loading;

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
            Upload a photo of the empty room, describe how you want it staged — Gemini does the rest.
            No floor plans, no measurements needed.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">

          {/* ── Form ──────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
            )}

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
                  <p className="text-xs text-stone-400 mt-1">Use a photo of the empty room taken with your phone or camera</p>
                </div>
              )}
            </div>

            {/* Staging brief */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5 space-y-3">
              <label className="block text-sm font-semibold text-stone-800">Staging brief</label>

              {/* Inspiration chips */}
              <div className="flex flex-wrap gap-2">
                {INSPIRATIONS.map((ins) => (
                  <button
                    key={ins.label}
                    type="button"
                    onClick={() => setBrief(ins.text)}
                    className="text-xs px-3 py-1.5 rounded-full border transition-all"
                    style={brief === ins.text
                      ? { borderColor: "#D4A574", background: "rgba(212,165,116,0.12)", color: "#062C3D", fontWeight: 600 }
                      : { borderColor: "#E7E5E0", background: "white", color: "#6B7280" }}
                  >
                    {ins.label}
                  </button>
                ))}
              </div>

              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="e.g. This is a living room in an Edwardian house. Please stage it with traditional furniture in keeping with the period — add some art on the walls, fresh plants, and warm lighting that makes it feel like a welcoming family home."
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
                  Staging your room — this takes 20–40 seconds…
                </span>
              ) : "Generate virtual staging →"}
            </button>
          </form>

          {/* ── Result / placeholder ─────────────────────────────────── */}
          <div className="space-y-4">
            {result && <ResultCard result={result} brief={brief} />}

            {!result && !loading && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{ background: "#EEF6F8" }}>
                  🏠
                </div>
                <p className="text-sm font-semibold text-stone-700 mb-2">Your staged room appears here</p>
                <p className="text-xs text-stone-400 leading-relaxed max-w-xs mx-auto">
                  Upload a photo of the empty room, write a brief, and hit generate.
                  Download the result and use it in your listing.
                </p>
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-10 text-center">
                <div className="w-12 h-12 rounded-full border-2 border-stone-200 border-t-[#D4A574] animate-spin mx-auto mb-4" />
                <p className="text-sm font-semibold text-stone-700">Staging your room…</p>
                <p className="text-xs text-stone-400 mt-1">Gemini is reading the photo and applying your brief.</p>
              </div>
            )}

            {/* How to use tip */}
            {!result && (
              <div className="rounded-2xl p-5 border text-xs text-stone-600 leading-relaxed space-y-2"
                style={{ background: "#EEF6F8", borderColor: "#AECFDB" }}>
                <p className="font-semibold text-stone-800">Tips for best results</p>
                <ul className="space-y-1.5 list-disc list-inside text-stone-500">
                  <li>Use a wide-angle photo that shows the whole room</li>
                  <li>Shoot in daylight with lights off to avoid colour casts</li>
                  <li>Empty rooms work best — remove clutter before photographing</li>
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
