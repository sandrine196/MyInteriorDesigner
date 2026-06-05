"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { admin, type BackupEntry, type BackupStats, type SystemStats, type SystemHealth, type ProductSourceStats } from "@/lib/api";

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-4">{title}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: "#1a3044", border: "1px solid #243d52" }}>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "ok" ? "#22c55e" : status === "missing_key" ? "#f59e0b" : "#ef4444";
  return <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: color }} />;
}

// ── Backup section ─────────────────────────────────────────────────────────────

function RestoreModal({ backups, onClose }: { backups: BackupEntry[]; onClose: () => void }) {
  const [selected,    setSelected]    = useState(backups[0]?.key ?? "");
  const [restoring,   setRestoring]   = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function doRestore() {
    if (confirmText !== "RESTORE") return;
    setRestoring(true);
    setError(null);
    try {
      const r = await admin.backups.restore(selected);
      alert(`Restore complete — ${r.rowsRestored.toLocaleString()} rows restored.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed. Check Railway logs.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ background: "#112231", border: "1px solid #243d52" }}>
        <div>
          <h3 className="text-base font-semibold text-white">Restore database from backup</h3>
          <p className="text-xs text-red-400 mt-1">This will DELETE all current data and replace it with the selected backup.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-stone-400 font-medium">Select backup</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white bg-transparent border border-stone-700 focus:outline-none focus:border-stone-500"
          >
            {backups.map(b => (
              <option key={b.key} value={b.key} style={{ background: "#1a3044" }}>
                {b.filename} — {b.formattedDate}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-stone-400 font-medium">
            Type <span className="font-mono text-amber-400">RESTORE</span> to confirm
          </label>
          <input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="RESTORE"
            className="w-full rounded-lg px-3 py-2 text-sm text-white bg-transparent border border-stone-700 focus:outline-none focus:border-stone-500 font-mono"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={restoring}
            className="px-4 py-2 rounded-lg text-sm text-stone-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={doRestore}
            disabled={confirmText !== "RESTORE" || restoring}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
            style={{ background: "#b91c1c" }}
          >
            {restoring ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-red-300 border-t-white animate-spin" />
                Restoring…
              </span>
            ) : "Restore now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackupSection() {
  const [stats,          setStats]          = useState<BackupStats | null>(null);
  const [backups,        setBackups]        = useState<BackupEntry[]>([]);
  const [running,        setRunning]        = useState(false);
  const [result,         setResult]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [showRestore,    setShowRestore]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([admin.backups.stats(), admin.backups.list()]);
      setStats(s);
      setBackups(b.backups);
    } catch {
      // R2 might not be reachable from dev
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runBackup() {
    if (!confirm("Run a manual backup now? This may take 30–60 seconds.")) return;
    setRunning(true);
    setResult(null);
    try {
      const r = await admin.backups.run();
      setResult({ ok: true, msg: `Backup completed! ${r.filename} (${r.sizeMB} MB, ${r.rowCount?.toLocaleString()} rows)` });
      load();
    } catch (e) {
      setResult({ ok: false, msg: `Backup failed. ${e instanceof Error ? e.message : "Check Railway logs."}` });
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      {showRestore && backups.length > 0 && (
        <RestoreModal backups={backups} onClose={() => { setShowRestore(false); load(); }} />
      )}

      <div className="space-y-4">
        <SectionHeader title="Database backup" />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Total backups</p>
            <p className="text-3xl font-bold text-white">{loading ? "—" : stats?.totalBackups ?? 0}</p>
            <p className="text-xs text-stone-500 mt-1">kept in R2 (last 30)</p>
          </Card>
          <Card>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Latest backup</p>
            <p className="text-sm font-bold text-white truncate">{loading ? "—" : stats?.latestBackup?.formattedDate ?? "None yet"}</p>
            <p className="text-xs text-stone-500 mt-1">{stats?.latestBackup?.sizeMB ?? "—"} MB · {stats?.method ?? "—"}</p>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Total stored size</p>
            <p className="text-3xl font-bold text-white">{loading ? "—" : `${stats?.totalSizeMB ?? "0"} MB`}</p>
            <p className="text-xs text-stone-500 mt-1">across all backups</p>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm font-medium text-stone-200">Backup &amp; restore</p>
              <p className="text-xs text-stone-500 mt-0.5">Automated backups run daily at 02:00 London time · Prisma JSON</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRestore(true)}
                disabled={loading || backups.length === 0}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "#2d1515", color: "#fca5a5", border: "1px solid #7f1d1d" }}
              >
                Restore from backup…
              </button>
              <button
                onClick={runBackup}
                disabled={running}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ background: running ? "#1e3d54" : "#1B4965" }}
              >
                {running ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-stone-400 border-t-white animate-spin" />
                    Running…
                  </span>
                ) : "Run Backup Now"}
              </button>
            </div>
          </div>
          {result && (
            <p className={`mt-3 text-sm font-medium ${result.ok ? "text-green-400" : "text-red-400"}`}>
              {result.ok ? "✅" : "❌"} {result.msg}
            </p>
          )}
        </Card>

        {/* Backup list */}
        <div className="rounded-2xl overflow-hidden border border-stone-800">
          <div className="px-4 py-3 border-b border-stone-800 flex items-center justify-between" style={{ background: "#1a3044" }}>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Recent backups</p>
            <button onClick={load} className="text-xs text-stone-500 hover:text-stone-300 transition-colors">↻ Refresh</button>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-center text-stone-600 text-sm">Loading…</div>
          ) : backups.length === 0 ? (
            <div className="px-4 py-6 text-center text-stone-600 text-sm">No backups yet — click "Run Backup Now" to create the first one</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 border-b border-stone-800" style={{ background: "#1a3044" }}>
                  <th className="text-left px-4 py-2.5 font-medium">Filename</th>
                  <th className="text-right px-4 py-2.5 font-medium">Size</th>
                  <th className="text-right px-4 py-2.5 font-medium">Method</th>
                  <th className="text-right px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr key={b.key} className="border-b border-stone-800/50 hover:bg-stone-800/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-300">{b.filename}</td>
                    <td className="px-4 py-2.5 text-right text-stone-400 text-xs">{b.sizeMB} MB</td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">{b.method}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500 text-xs">{b.formattedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// ── DB stats section ────────────────────────────────────────────────────────────

function DbStatsSection() {
  const [stats,   setStats]   = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    admin.system.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionHeader title="Database statistics" />
      <div className="rounded-2xl overflow-hidden border border-stone-800">
        {loading ? (
          <div className="px-4 py-6 text-center text-stone-600 text-sm">Loading…</div>
        ) : !stats ? (
          <div className="px-4 py-6 text-center text-stone-600 text-sm">Unable to load stats</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 border-b border-stone-800" style={{ background: "#1a3044" }}>
                <th className="text-left px-4 py-2.5 font-medium">Table</th>
                <th className="text-right px-4 py-2.5 font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              {stats.tables.map(t => (
                <tr key={t.name} className="border-b border-stone-800/50 hover:bg-stone-800/20">
                  <td className="px-4 py-2.5 text-stone-300">{t.name}</td>
                  <td className="px-4 py-2.5 text-right text-white font-semibold tabular-nums">{t.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── System health section ───────────────────────────────────────────────────────

function HealthSection() {
  const [health,  setHealth]  = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const h = await admin.system.health();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="System health" />
        <button onClick={load} disabled={loading}
          className="text-xs text-stone-500 hover:text-stone-300 transition-colors mb-4">
          {loading ? "Checking…" : "↻ Re-check"}
        </button>
      </div>
      <Card>
        {loading ? (
          <div className="py-4 text-center text-stone-600 text-sm">Running checks…</div>
        ) : !health ? (
          <div className="py-4 text-center text-red-400 text-sm">Health check failed — check Railway logs</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${health.status === "ok" ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                {health.status}
              </span>
              <span className="text-xs text-stone-600">{new Date(health.timestamp).toLocaleTimeString("en-GB")}</span>
            </div>
            {Object.entries(health.checks).map(([key, check]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-stone-800/50">
                <div className="flex items-center">
                  <StatusDot status={check.status} />
                  <span className="text-sm text-stone-200 capitalize">{key.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-4">
                  {check.responseMs != null && (
                    <span className="text-xs text-stone-600">{check.responseMs}ms</span>
                  )}
                  <span className={`text-xs font-medium ${check.status === "ok" ? "text-green-400" : check.status === "missing_key" ? "text-amber-400" : "text-red-400"}`}>
                    {check.status === "missing_key" ? "Key not set" : check.status === "ok" ? "OK" : check.detail ?? "Error"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Product sources section ─────────────────────────────────────────────────────

function DbCheckSection() {
  const [result,  setResult]  = useState<{ total: number; byRetailer: { retailer: string; source: string | null; _count: { _all: number } }[]; databaseUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const r = await admin.products.dbCheck();
      setResult(r);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Live DB diagnostic" />
        <button onClick={run} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white mb-4 disabled:opacity-40" style={{ background: "#1B4965" }}>
          {loading ? "Checking…" : "Run Check"}
        </button>
      </div>
      {result && (
        <Card>
          <p className="text-xs text-stone-400 font-mono mb-3 break-all">{result.databaseUrl}</p>
          <p className="text-sm text-white font-semibold mb-2">Total products: {result.total}</p>
          <div className="space-y-1">
            {result.byRetailer.map((r) => (
              <div key={`${r.retailer}-${r.source}`} className="flex justify-between text-xs">
                <span className="text-stone-300">{r.retailer} <span className="text-stone-600">{r.source ? `(${r.source})` : "(manual)"}</span></span>
                <span className="text-white font-semibold">{r._count._all}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProductSourcesSection() {
  const [sources,        setSources]        = useState<ProductSourceStats[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [importing,      setImporting]      = useState(false);
  const [assigning,      setAssigning]      = useState(false);
  const [result,         setResult]         = useState<{ ok: boolean; msg: string } | null>(null);
  const [styleResult,    setStyleResult]    = useState<{ processed: number; byStyle: Record<string, number> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await admin.products.sources();
      setSources(data.sources);
    } catch {
      // CJ keys may not be configured in dev
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runImport() {
    if (!confirm("Run Raft Furniture import now? This may take several minutes.")) return;
    setImporting(true);
    setResult(null);
    setStyleResult(null);
    try {
      const r = await admin.products.importRaft();
      setResult({ ok: true, msg: `Import complete — ${r.imported} new, ${r.updated} updated, ${r.skipped} skipped (${r.total} total, ${r.withDimensions} with dimensions, ${r.stylesAssigned} tagged)` });
      load();
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Import failed — check Railway logs" });
    } finally {
      setImporting(false);
    }
  }

  async function runAssignStyles() {
    setAssigning(true);
    setStyleResult(null);
    try {
      const r = await admin.products.assignStyles();
      setStyleResult({ processed: r.processed, byStyle: r.byStyle });
      load();
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : "Style assignment failed — check Railway logs" });
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader title="Product sources" />
        <button onClick={load} disabled={loading} className="text-xs text-stone-500 hover:text-stone-300 transition-colors mb-4">
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {loading ? (
        <Card><div className="py-4 text-center text-stone-600 text-sm">Loading…</div></Card>
      ) : sources.length === 0 ? (
        <Card><div className="py-4 text-center text-stone-600 text-sm">No product sources configured</div></Card>
      ) : (
        sources.map(s => (
          <Card key={s.retailer}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-white">{s.label}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#1e3d54", color: "#93c5fd" }}>
                    via {s.via}
                  </span>
                  {!s.configured && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-900/40 text-amber-400">
                      Keys not set
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs text-stone-400 flex-wrap">
                  <span><span className="text-white font-semibold">{s.total.toLocaleString()}</span> products</span>
                  <span><span className="text-white font-semibold">{s.inStock.toLocaleString()}</span> in stock</span>
                  <span><span className="text-white font-semibold">{s.total > 0 ? Math.round((s.withDimensions / s.total) * 100) : 0}%</span> with dimensions</span>
                  <span>Last sync: <span className="text-stone-300">{s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString("en-GB") : "Never"}</span></span>
                </div>
                {Object.keys(s.byCategory).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(s.byCategory)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([cat, count]) => (
                        <span key={cat} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#243d52", color: "#94a3b8" }}>
                          {cat}: {count}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={runAssignStyles}
                  disabled={assigning || importing}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                  style={{ background: "#1e3d20", color: "#86efac", border: "1px solid #166534" }}
                >
                  {assigning ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-green-400 border-t-white animate-spin" />
                      Tagging…
                    </span>
                  ) : "Assign Styles"}
                </button>
                <button
                  onClick={runImport}
                  disabled={importing || !s.configured}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
                  style={{ background: importing ? "#1e3d54" : "#1B4965" }}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-stone-400 border-t-white animate-spin" />
                      Importing…
                    </span>
                  ) : "Import Now"}
                </button>
              </div>
            </div>
            {result && (
              <p className={`mt-3 text-sm font-medium ${result.ok ? "text-green-400" : "text-red-400"}`}>
                {result.ok ? "✅" : "❌"} {result.msg}
              </p>
            )}
            {styleResult && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-green-400">✅ {styleResult.processed} products tagged with styles</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(styleResult.byStyle)
                    .sort(([, a], [, b]) => b - a)
                    .map(([style, count]) => (
                      <span key={style} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#243d52", color: "#94a3b8" }}>
                        {style}: {count}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </Card>
        ))
      )}
      <p className="text-xs text-stone-600">Auto-import runs daily at 03:00 London time.</p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SystemPage() {
  return (
    <div className="space-y-14 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">System</h1>
        <p className="text-stone-500 text-sm mt-1">Backups, database stats, and service health</p>
      </div>
      <DbCheckSection />
      <ProductSourcesSection />
      <BackupSection />
      <DbStatsSection />
      <HealthSection />
    </div>
  );
}
