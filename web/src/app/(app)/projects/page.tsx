"use client";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { projects as api, ApiError, type Project } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function ProjectsPage() {
  const router = useRouter();
  const [list, setList] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    api.list()
      .then((r) => setList(r.projects))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { project } = await api.create(name.trim());
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project");
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
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Your rooms</h1>
        <p className="text-stone-500 mt-1 text-sm">Design each room in your new home, one at a time.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Start a new room</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. Living room, Main bedroom, Kitchen…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap"
          >
            {creating ? "Creating…" : "Create room →"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>

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
          <div className="w-16 h-16 bg-sage-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <h3 className="text-stone-900 font-semibold text-lg mb-2">Ready to design your first room?</h3>
          <p className="text-stone-500 text-sm max-w-sm mx-auto mb-5">
            Give your room a name above — like "Living room" or "Main bedroom" — and we'll walk you through designing it step by step.
          </p>
          <p className="text-xs text-stone-400">Upload your floor plan · Pick furniture · Generate a photorealistic render</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <li key={p.id} className="relative group">
              {/* Delete button */}
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
                className="w-full text-left bg-white rounded-2xl border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all p-5"
              >
                {p.renders[0]?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.renders[0].imageUrl.startsWith("http") ? p.renders[0].imageUrl : `${API_BASE}${p.renders[0].imageUrl}`}
                    alt="Latest render"
                    className="w-full h-36 object-cover rounded-xl mb-4"
                  />
                ) : (
                  <div className="w-full h-36 bg-stone-50 rounded-xl mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                )}
                <p className="font-semibold text-stone-900 mb-1 truncate group-hover:text-sage-700 transition-colors pr-6">
                  {p.name}
                </p>
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
