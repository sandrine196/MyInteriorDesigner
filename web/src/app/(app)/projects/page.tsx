"use client";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { projects as api, ApiError, type Project, type RoomType } from "@/lib/api";
import { RoomTypeSelector } from "@/components/RoomTypeSelector";
import { config } from "@/config";

const API_BASE = config.apiUrl;

const ROOM_TYPE_META: Record<RoomType, { label: string; icon: string }> = {
  living_room:       { label: "Living Room",              icon: "🛋️" },
  dining_room:       { label: "Dining Room",              icon: "🍽️" },
  living_dining:     { label: "Living / Dining",          icon: "🛋️🍽️" },
  bedroom_primary:   { label: "Primary Bedroom",          icon: "🛏️" },
  bedroom_secondary: { label: "Guest Bedroom",            icon: "🛏️" },
  home_office:       { label: "Home Office",              icon: "💼" },
  bathroom:          { label: "Bathroom",                 icon: "🛁" },
  kitchen:           { label: "Kitchen",                  icon: "🍳" },
};

const DEFAULT_NAMES: Record<RoomType, string> = {
  living_room:       "Living Room",
  dining_room:       "Dining Room",
  living_dining:     "Living / Dining",
  bedroom_primary:   "Primary Bedroom",
  bedroom_secondary: "Guest Bedroom",
  home_office:       "Home Office",
  bathroom:          "Bathroom",
  kitchen:           "Kitchen",
};

type CreateStep = "type" | "name";

export default function ProjectsPage() {
  const router = useRouter();
  const [list, setList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation flow
  const [createStep, setCreateStep] = useState<CreateStep>("type");
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Delete flow
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    api.list()
      .then((r) => setList(r.projects))
      .finally(() => setLoading(false));
  }, []);

  function handleTypeSelect(type: RoomType) {
    setRoomType(type);
    setName(DEFAULT_NAMES[type]);
    setTimeout(() => setCreateStep("name"), 280);
  }

  function handleBack() {
    setCreateStep("type");
    setCreateError("");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!roomType || !name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const { project } = await api.create(name.trim(), roomType);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to create project");
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    setDeleteError(null);
    try {
      await api.delete(id);
      setList((prev) => prev.filter((p) => p.id !== id));
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Failed to delete — please try again");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1B4965" }}>Your rooms</h1>
        <p className="text-stone-500 mt-1 text-sm">Design each room in your new home, one at a time.</p>
      </div>

      {/* ── Creation panel ───────────────────────────────────────────────── */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8 shadow-sm">
        {createStep === "type" ? (
          <>
            <p className="text-sm font-semibold text-stone-700 mb-4">Start a new room</p>
            <RoomTypeSelector selected={roomType} onSelect={handleTypeSelect} />
          </>
        ) : (
          <form onSubmit={handleCreate}>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={handleBack}
                className="text-stone-400 hover:text-stone-700 transition-colors text-sm"
              >
                ← Back
              </button>
              {roomType && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border border-stone-200 text-stone-600">
                  <span>{ROOM_TYPE_META[roomType].icon}</span>
                  <span>{ROOM_TYPE_META[roomType].label}</span>
                </span>
              )}
            </div>

            <label className="block text-sm font-semibold text-stone-700 mb-2">
              Name this room
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g. Living Room, Master Bedroom…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-mid-gold focus:border-transparent placeholder:text-stone-400"
              />
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="disabled:opacity-40 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
                style={{ background: "#D4A574", color: "#1B4965" }}
              >
                {creating ? "Creating…" : "Create room →"}
              </button>
            </div>
            {createError && <p className="text-sm text-red-600 mt-3">{createError}</p>}
          </form>
        )}
      </div>

      {/* ── Room list ────────────────────────────────────────────────────── */}
      {loading ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse">
              <div className="w-full h-36 bg-stone-100 rounded-xl mb-4" />
              <div className="h-4 bg-stone-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-stone-100 rounded w-1/2" />
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#e8f0f5" }}>
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "#1B4965" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h3 className="font-bold text-lg mb-2" style={{ color: "#1B4965" }}>Ready to design your first room?</h3>
          <p className="text-stone-500 text-sm max-w-sm mx-auto mb-5">
            Choose a room type above — like Living Room or Primary Bedroom — and we&apos;ll walk you through designing it step by step.
          </p>
          <p className="text-xs text-stone-400">Upload your floor plan · Pick furniture · Generate a photorealistic render</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <li key={p.id} className="relative group">
              {confirmDelete === p.id ? (
                <div className="absolute inset-0 z-10 bg-white rounded-2xl border border-red-200 shadow-lg p-5 flex flex-col justify-center items-center gap-3">
                  <p className="text-sm font-medium text-stone-800 text-center">
                    Delete <span className="font-semibold">{p.name}</span>?
                  </p>
                  <p className="text-xs text-stone-400 text-center">This will remove all renders for this room.</p>
                  {deleteError && (
                    <p className="text-xs text-red-600 text-center bg-red-50 px-3 py-2 rounded-lg">{deleteError}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => { setConfirmDelete(null); setDeleteError(null); }}
                      className="px-4 py-2 text-sm rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="px-4 py-2 text-sm rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium transition-colors"
                    >
                      {deleting === p.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); setDeleteError(null); }}
                  className="absolute top-3 right-3 z-10 p-2 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  aria-label="Delete project"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => router.push(`/projects/${p.id}`)}
                className="w-full text-left bg-white rounded-2xl border border-stone-200 hover:border-mid-blue-light hover:shadow-md transition-all p-5"
              >
                {p.renders[0]?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.renders[0].imageUrl.startsWith("http") ? p.renders[0].imageUrl : `${API_BASE}${p.renders[0].imageUrl}`}
                    alt="Latest render"
                    className="w-full h-36 object-cover rounded-xl mb-4"
                  />
                ) : (
                  <div className="w-full h-36 rounded-xl mb-4 flex items-center justify-center text-4xl" style={{ background: "#e8f0f5" }}>
                    {p.roomType ? ROOM_TYPE_META[p.roomType]?.icon : (
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: "#2A5F7F" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    )}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-stone-900 truncate pr-6 group-hover:text-mid-blue transition-colors">
                    {p.name}
                  </p>
                </div>

                {p.roomType && (
                  <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 rounded-full px-2.5 py-0.5 mb-2">
                    <span>{ROOM_TYPE_META[p.roomType].icon}</span>
                    <span>{ROOM_TYPE_META[p.roomType].label}</span>
                  </span>
                )}

                <p className="text-xs text-stone-400">
                  {p.renders.length === 0 ? "No renders yet" : `${p.renders.length} render${p.renders.length !== 1 ? "s" : ""}`}
                  {" · "}
                  {new Date(p.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
