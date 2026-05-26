"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, clearToken } from "@/lib/api";

function Section({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-stone-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-stone-200 bg-white">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        <p className="text-xs text-stone-500 mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5 bg-stone-50">{children}</div>
    </div>
  );
}

function DeleteModal({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [value,    setValue]    = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirmed = value === "DELETE";

  async function handleDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await auth.deleteAccount();
      onDeleted();
    } catch {
      setError("Something went wrong. Please try again or contact support.");
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </span>
            <h3 className="text-base font-semibold text-stone-900">Delete your account</h3>
          </div>
          <p className="text-sm text-stone-500 mt-1">This action cannot be undone.</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-stone-700 leading-relaxed">
            Deleting your account will permanently remove:
          </p>
          <ul className="text-sm text-stone-600 space-y-1.5 pl-4 list-disc leading-relaxed">
            <li>Your profile and login credentials</li>
            <li>All room projects and settings</li>
            <li>All generated room renders (deleted from storage)</li>
            <li>Your product click history</li>
          </ul>
          <p className="text-sm text-stone-700">
            A confirmation email will be sent to you after deletion.
          </p>

          <div className="pt-1 space-y-1.5">
            <label className="text-xs font-medium text-stone-700">
              Type <span className="font-mono font-bold text-red-700">DELETE</span> to confirm
            </label>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && confirmed) handleDelete(); }}
              placeholder="DELETE"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || deleting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: confirmed && !deleting ? "#dc2626" : "#fca5a5" }}
          >
            {deleting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-red-200 border-t-white animate-spin" />
                Deleting…
              </>
            ) : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();

  const [downloading,  setDownloading]  = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [downloadErr,  setDownloadErr]  = useState<string | null>(null);
  const [showDelete,   setShowDelete]   = useState(false);

  async function downloadData() {
    setDownloading(true);
    setDownloadDone(false);
    setDownloadErr(null);
    try {
      const blob = await auth.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-interior-designer-data.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadDone(true);
    } catch {
      setDownloadErr("Something went wrong preparing your export. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function handleDeleted() {
    clearToken();
    router.push("/");
  }

  return (
    <>
      {showDelete && (
        <DeleteModal onClose={() => setShowDelete(false)} onDeleted={handleDeleted} />
      )}

      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Account settings</h1>
          <p className="text-sm text-stone-500 mt-1">Manage your data and privacy preferences</p>
        </div>

        {/* Download section */}
        <Section
          title="Download my data"
          description="Receive a copy of everything we hold about you — satisfies GDPR Subject Access Requests."
        >
          <p className="text-sm text-stone-600 mb-4 leading-relaxed">
            Your export is a ZIP file containing:
          </p>
          <ul className="text-sm text-stone-600 space-y-1.5 mb-5 ml-1">
            {[
              ["profile.json",  "Your email address, account tier, and sign-up date"],
              ["projects.json", "All your room projects and their settings"],
              ["renders/",      "All your generated room images as PNG files"],
              ["usage.json",    "Product clicks and in-app activity"],
            ].map(([file, desc]) => (
              <li key={file} className="flex gap-3">
                <span className="font-mono text-xs bg-stone-200 text-stone-700 rounded px-1.5 py-0.5 shrink-0 self-start mt-0.5">
                  {file}
                </span>
                <span>{desc}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={downloadData}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60"
            style={{ background: downloading ? "#8ca4b5" : "#1B4965" }}
          >
            {downloading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Preparing your data…
              </>
            ) : "Download my data"}
          </button>

          {downloadDone && (
            <p className="mt-3 text-sm text-green-700 font-medium">
              Download started — check your downloads folder.
            </p>
          )}
          {downloadErr && (
            <p className="mt-3 text-sm text-red-600">{downloadErr}</p>
          )}

          <p className="text-xs text-stone-400 mt-4">
            Large exports (many renders) may take up to 30 seconds to prepare.
          </p>
        </Section>

        {/* Privacy / delete section */}
        <Section
          title="Privacy"
          description="Permanently remove your account and all associated data from our systems."
        >
          <p className="text-sm text-stone-600 mb-4 leading-relaxed">
            Deleting your account is irreversible. All your projects, renders, and personal data
            will be permanently erased. You'll receive a confirmation email once completed.
          </p>
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "#dc2626" }}
          >
            Delete my account
          </button>
          <p className="text-xs text-stone-400 mt-3">
            We recommend downloading your data first — you won't be able to recover it afterwards.
          </p>
        </Section>
      </div>
    </>
  );
}
