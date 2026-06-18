"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { redesign, ApiError, type RedesignResult } from "@/lib/api";
import { config } from "@/config";

// ── Constants ────────────────────────────────────────────────────────────────

const STYLES = [
  { id: "scandinavian", label: "Scandinavian", emoji: "🌿" },
  { id: "modern",       label: "Modern",       emoji: "⬜" },
  { id: "traditional",  label: "Traditional",  emoji: "🏛️" },
  { id: "industrial",   label: "Industrial",   emoji: "🔧" },
  { id: "coastal",      label: "Coastal",      emoji: "🌊" },
  { id: "mid_century",  label: "Mid-Century",  emoji: "🪑" },
];

const LOADING_STEPS = [
  { label: "Clearing the room",         duration: 15000 },
  { label: "Imagining your new space",  duration: 5000  },
  { label: "Bringing it to life",       duration: 15000 },
];

// ── Before/after slider ──────────────────────────────────────────────────────

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  function onMove(clientX: number) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }

  return (
    <div
      ref={ref}
      className="relative w-full rounded-2xl overflow-hidden cursor-col-resize select-none"
      style={{ aspectRatio: "4/3" }}
      onMouseMove={(e) => { if (e.buttons === 1) onMove(e.clientX); }}
      onTouchMove={(e) => { const t = e.touches[0]; if (t) onMove(t.clientX); }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Your room" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="Redesigned" className="absolute inset-0 w-full h-full object-cover" />
      </div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3M16 9l4 3-4 3" />
          </svg>
        </div>
      </div>
      <span className="absolute bottom-3 left-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">Your room</span>
      <span className="absolute bottom-3 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ left: `${pos + 1}%`, background: "#D4A574", color: "#1B3050" }}>Redesigned ✨</span>
    </div>
  );
}

// ── Photo dropzone ───────────────────────────────────────────────────────────

function PhotoDropzone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f: File) => { if (f.type.startsWith("image/")) onFile(f); };

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer ${dragging ? "border-[#D4A574] bg-[#D4A574]/5" : "border-stone-300 hover:border-[#062C3D]"}`}
      style={{ padding: "3rem 2rem" }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) accept(f); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }}
      />
      <div className="text-center space-y-3">
        <div className="text-5xl">📷</div>
        <div>
          <p className="font-semibold text-stone-800 text-lg">Drop a photo or tap to upload</p>
          <p className="text-stone-500 text-sm mt-1">Works on any room · JPEG, PNG, WebP · up to 10 MB</p>
        </div>
        <div
          className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-sm shadow-sm"
          style={{ background: "#062C3D", color: "white" }}
        >
          📷 Choose a photo
        </div>
      </div>
    </div>
  );
}

// ── Loading steps ─────────────────────────────────────────────────────────────

function LoadingPanel({ step }: { step: number }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12">
      {/* Animated room icon */}
      <div className="relative w-20 h-20">
        <div className="w-20 h-20 rounded-2xl border-4 border-stone-200 border-t-[#D4A574] animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-3xl">🏠</div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {LOADING_STEPS.map((s, i) => {
          const isActive = step === i + 1;
          const isDone   = step > i + 1;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold transition-all ${
                isDone   ? "bg-emerald-100 text-emerald-600" :
                isActive ? "bg-[#D4A574] text-white" :
                           "bg-stone-100 text-stone-400"
              }`}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-sm font-medium transition-colors ${isActive ? "text-stone-900" : isDone ? "text-stone-400 line-through" : "text-stone-300"}`}>
                {s.label}
              </span>
              {isActive && <span className="ml-auto flex gap-1">{[0,1,2].map(j => <span key={j} className="w-1.5 h-1.5 rounded-full bg-[#D4A574] animate-bounce" style={{ animationDelay: `${j * 150}ms` }} />)}</span>}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-stone-400">This usually takes about 40 seconds</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Screen = "landing" | "style-pick" | "loading" | "reveal";

export default function RedesignPage() {
  const [screen,        setScreen]       = useState<Screen>("landing");
  const [photo,         setPhoto]        = useState<File | null>(null);
  const [photoPreview,  setPhotoPreview] = useState<string | null>(null);
  const [loadingStep,   setLoadingStep]  = useState(1);
  const [result,        setResult]       = useState<RedesignResult | null>(null);
  const [currentStyle,  setCurrentStyle] = useState<string | null>(null);
  const [restagesLeft,  setRestagesLeft] = useState(2);
  const [error,         setError]        = useState<string | null>(null);
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    stepTimers.current.forEach(clearTimeout);
    stepTimers.current = [];
  }

  function startLoadingSteps() {
    setLoadingStep(1);
    let elapsed = 0;
    for (let i = 0; i < LOADING_STEPS.length - 1; i++) {
      elapsed += LOADING_STEPS[i].duration;
      const next = i + 2;
      stepTimers.current.push(setTimeout(() => setLoadingStep(next), elapsed));
    }
  }

  function handlePhotoSelect(file: File) {
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setScreen("style-pick");
  }

  async function handleStyleSelect(styleId: string) {
    if (!photo) return;
    setCurrentStyle(styleId);
    setScreen("loading");
    clearTimers();
    startLoadingSteps();
    setError(null);
    try {
      const res = await redesign.full(photo, styleId);
      setResult(res);
      setRestagesLeft(2);
      setScreen("reveal");
    } catch (err) {
      clearTimers();
      if (err instanceof ApiError && err.status === 429) {
        setError(err.message);
        setScreen("landing");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong — please try again");
        setScreen("style-pick");
      }
    }
  }

  async function handleTryAnotherStyle(styleId: string) {
    if (!result) return;
    setCurrentStyle(styleId);
    setScreen("loading");
    clearTimers();
    // Faster: only 2 steps (no furniture removal)
    setLoadingStep(2); // skip step 1 (already cleared)
    stepTimers.current.push(setTimeout(() => setLoadingStep(3), LOADING_STEPS[1].duration));
    setError(null);
    try {
      const res = await redesign.restage(styleId);
      setResult(prev => prev ? { ...prev, stagedImageUrl: res.stagedImageUrl } : prev);
      setRestagesLeft(res.restagesRemaining);
      setScreen("reveal");
    } catch (err) {
      clearTimers();
      if (err instanceof ApiError && err.status === 429) {
        setError("You've used all your free restyles. Sign up free for unlimited redesigns →");
      }
      setScreen("reveal"); // stay on reveal even if restage fails
    }
  }

  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.stagedImageUrl;
    a.download = `my-redesigned-room-${currentStyle}.png`;
    a.click();
  }

  function resetAll() {
    clearTimers();
    setScreen("landing");
    setPhoto(null);
    setPhotoPreview(null);
    setResult(null);
    setCurrentStyle(null);
    setError(null);
  }

  const resolve = (url: string) => url.startsWith("http") ? url : `${config.apiUrl}${url}`;

  return (
    <div className="min-h-screen" style={{ background: "#F7F6F3" }}>
      {/* Minimal header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-stone-200/60 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <Image src="/MIDLogo.png" alt="My Interior Designer" width={100} height={70} className="h-8 w-auto object-contain" priority />
          </Link>
          {screen !== "landing" && (
            <button onClick={resetAll} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
              Start over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-10">

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {error && screen !== "reveal" && (
          <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}{" "}
            {error.includes("Sign up") && <Link href="/register" className="underline font-semibold">Sign up free →</Link>}
          </div>
        )}

        {/* ── Screen 1: Landing ─────────────────────────────────────────── */}
        {screen === "landing" && (
          <div className="space-y-6">
            <div className="text-center space-y-2 pt-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest rounded-full px-3 py-1.5 mb-2"
                style={{ background: "rgba(212,165,116,0.15)", color: "#D4A574", border: "1px solid rgba(212,165,116,0.3)" }}>
                FREE · NO SIGN UP NEEDED
              </div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight leading-tight">
                See your room redesigned<br />in 40 seconds
              </h1>
              <p className="text-stone-500">Upload a photo — AI does the rest</p>
            </div>

            <PhotoDropzone onFile={handlePhotoSelect} />

            <p className="text-center text-xs text-stone-400">
              ✨ Powered by AI · Your photo stays private
            </p>
          </div>
        )}

        {/* ── Screen 2: Style pick ──────────────────────────────────────── */}
        {screen === "style-pick" && (
          <div className="space-y-6">
            {/* Show cleared room thumbnail if restyling */}
            {result ? (
              <div className="rounded-xl overflow-hidden border border-stone-200 aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolve(result.emptyRoomUrl)} alt="Your cleared room" className="w-full h-full object-cover" />
              </div>
            ) : photoPreview ? (
              <div className="rounded-xl overflow-hidden border border-stone-200 aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Your room" className="w-full h-full object-cover" />
              </div>
            ) : null}

            <div className="text-center">
              <h2 className="text-xl font-bold text-stone-900">Pick a style</h2>
              <p className="text-sm text-stone-500 mt-1">
                {result ? "Restyle in ~15 seconds" : "Tap one to start — no other steps"}
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {STYLES.map((s) => {
                const isActive = s.id === currentStyle;
                return (
                  <button
                    key={s.id}
                    onClick={() => result ? handleTryAnotherStyle(s.id) : handleStyleSelect(s.id)}
                    className="flex flex-col items-center gap-2 rounded-2xl border-2 py-5 px-4 transition-all hover:border-[#062C3D] hover:shadow-sm active:scale-95"
                    style={{
                      borderColor: isActive ? "#062C3D" : "#E7E5E0",
                      background: isActive ? "#EEF6F8" : "white",
                    }}
                  >
                    <span className="text-3xl">{s.emoji}</span>
                    <span className="text-sm font-semibold text-stone-800">{s.label}</span>
                    {isActive && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#062C3D", color: "white" }}>
                        Current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button onClick={resetAll} className="w-full text-xs text-stone-400 hover:text-stone-600 transition-colors py-2">
              ← Choose a different photo
            </button>
          </div>
        )}

        {/* ── Screen 3: Loading ─────────────────────────────────────────── */}
        {screen === "loading" && <LoadingPanel step={loadingStep} />}

        {/* ── Screen 4: Reveal ──────────────────────────────────────────── */}
        {screen === "reveal" && result && (
          <div className="space-y-6">
            {/* Hero before/after slider */}
            <BeforeAfterSlider
              before={resolve(result.originalImageUrl)}
              after={resolve(result.stagedImageUrl)}
            />

            {/* Error on restage fail */}
            {error && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl border transition-colors hover:bg-stone-50"
                style={{ borderColor: "#D0CCC5", color: "#62584E" }}
              >
                ⬇️ Download
              </button>
              {restagesLeft > 0 && (
                <button
                  onClick={() => setScreen("style-pick")}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl border transition-colors hover:bg-stone-50"
                  style={{ borderColor: "#D0CCC5", color: "#62584E" }}
                >
                  🎨 Try another style
                </button>
              )}
            </div>

            {/* Soft conversion */}
            <div className="rounded-2xl p-6 text-center space-y-3 border border-stone-200 bg-white">
              <p className="font-semibold text-stone-900 text-base">Like what you see?</p>
              <p className="text-sm text-stone-500">Sign up free to save your designs and shop the furniture</p>
              <Link
                href="/register"
                onClick={() => fetch(`${config.apiUrl}/redesign/track-signup`, { method: "POST", credentials: "include" }).catch(() => {})}
                className="inline-flex items-center justify-center w-full font-semibold px-6 py-3.5 rounded-xl text-sm transition-all shadow-sm hover:opacity-90"
                style={{ background: "#062C3D", color: "white" }}
              >
                Sign up free to save &amp; shop this look →
              </Link>
              <p className="text-xs text-stone-400">
                Or{" "}
                <button onClick={resetAll} className="underline hover:text-stone-600 transition-colors">
                  try another photo
                </button>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
