"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";

type Agent = {
  id:              string;
  name:            string;
  agencyName:      string;
  email:           string;
  referralCode:    string;
  status:          string;
  clientsReferred: number;
  designsCreated:  number;
  createdAt:       string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: "#FEF3C7", color: "#92400E" },
  active:    { bg: "#D1FAE5", color: "#065F46" },
  suspended: { bg: "#FEE2E2", color: "#991B1B" },
};

export default function AdminAgentsPage() {
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    admin.agents.list()
      .then((res) => setAgents(res.agents))
      .catch(() => setError("Failed to load agents"))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await admin.agents.updateStatus(id, status);
      setAgents((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    } catch {
      alert("Failed to update status");
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-mid-blue border-t-mid-gold animate-spin" />
    </div>
  );

  if (error) return <p className="text-red-400 text-sm">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Partner Agents</h1>
          <p className="text-stone-400 text-sm mt-1">{agents.length} registered partner{agents.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="text-right text-sm">
          <p className="text-stone-300 font-semibold">{agents.reduce((s, a) => s + a.clientsReferred, 0)}</p>
          <p className="text-stone-500 text-xs">total clients referred</p>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-2xl border p-12 text-center" style={{ borderColor: "#1e3d54", background: "#122c3f" }}>
          <p className="text-stone-400 text-sm">No partner agents yet.</p>
          <p className="text-stone-500 text-xs mt-1">They&apos;ll appear here when agents sign up at /agents</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "#1e3d54" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "#122c3f" }}>
              <tr className="text-left">
                {["Agent", "Agency", "Referral code", "Clients", "Designs", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => {
                const s = STATUS_STYLES[agent.status] ?? STATUS_STYLES.pending;
                return (
                  <tr
                    key={agent.id}
                    style={{ background: i % 2 === 0 ? "#0f2535" : "#122c3f", borderTop: "1px solid #1e3d54" }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-100">{agent.name}</p>
                      <p className="text-xs text-stone-500">{agent.email}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-300">{agent.agencyName}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-[#D4A574] bg-black/20 px-2 py-0.5 rounded">{agent.referralCode}</code>
                    </td>
                    <td className="px-4 py-3 text-stone-300 font-semibold">{agent.clientsReferred}</td>
                    <td className="px-4 py-3 text-stone-300 font-semibold">{agent.designsCreated}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {new Date(agent.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={updating === agent.id}
                        value={agent.status}
                        onChange={(e) => updateStatus(agent.id, e.target.value)}
                        className="text-xs rounded-lg px-2 py-1.5 border disabled:opacity-50"
                        style={{ background: "#1B4965", color: "white", borderColor: "#2A5F7F" }}
                      >
                        <option value="pending">pending</option>
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
