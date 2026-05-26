"use client";
import { useState } from "react";
import { auth } from "@/lib/api";

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

export default function AccountPage() {
  const [downloading, setDownloading] = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function downloadData() {
    setDownloading(true);
    setDone(false);
    setError(null);
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
      setDone(true);
    } catch {
      setError("Something went wrong preparing your export. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Account settings</h1>
        <p className="text-sm text-stone-500 mt-1">Manage your data and privacy preferences</p>
      </div>

      <Section
        title="Download my data"
        description="Receive a copy of everything we hold about you — satisfies GDPR Subject Access Requests."
      >
        <p className="text-sm text-stone-600 mb-4 leading-relaxed">
          Your export includes a ZIP file containing:
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

        {done && (
          <p className="mt-3 text-sm text-green-700 font-medium">
            Download started — check your downloads folder.
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <p className="text-xs text-stone-400 mt-4">
          Large exports (many renders) may take up to 30 seconds to prepare.
        </p>
      </Section>
    </div>
  );
}
