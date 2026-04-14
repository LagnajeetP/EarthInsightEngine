"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { aoiApi, sceneApi, jobApi, type Aoi, type Scene, type Job } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import SeverityBadge from "@/components/SeverityBadge";

const CARD: React.CSSProperties = {
  background: "#0d1626",
  border: "1px solid #1a2540",
  borderRadius: 10,
  padding: "1.25rem 1.5rem",
};

const CHANGE_COLORS = {
  vegetation_loss: "#ef4444",
  vegetation_gain: "#22c55e",
  water_change: "#3b82f6",
  urban_expansion: "#f59e0b",
  bare_soil: "#a78bfa",
};

function NdviGauge({ before, after }: { before: number; after: number }) {
  const toPos = (v: number) => ((v + 1) / 2) * 100; // -1..1 → 0%..100%
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div style={{ fontSize: "0.72rem", color: "#4a6080", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        NDVI Before → After
      </div>
      <div style={{ position: "relative", height: 12, background: "linear-gradient(to right, #7f1d1d, #92400e, #4d7c0f, #166534)", borderRadius: 6 }}>
        <div
          style={{
            position: "absolute",
            top: -2, width: 16, height: 16, borderRadius: "50%",
            background: "#94a3b8", border: "2px solid #1a2540",
            left: `calc(${toPos(before)}% - 8px)`,
            transition: "left 0.5s",
          }}
          title={`Before: ${before.toFixed(3)}`}
        />
        <div
          style={{
            position: "absolute",
            top: -2, width: 16, height: 16, borderRadius: "50%",
            background: "#7eb8ff", border: "2px solid #1a2540",
            left: `calc(${toPos(after)}% - 8px)`,
            transition: "left 0.5s",
          }}
          title={`After: ${after.toFixed(3)}`}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#4a6080", marginTop: 6 }}>
        <span>-1 (bare)</span>
        <span>0</span>
        <span>+1 (dense veg)</span>
      </div>
      <div style={{ display: "flex", gap: "1.5rem", marginTop: 4, fontSize: "0.78rem" }}>
        <span style={{ color: "#94a3b8" }}>● Before: <strong>{before.toFixed(3)}</strong></span>
        <span style={{ color: "#7eb8ff" }}>● After: <strong>{after.toFixed(3)}</strong></span>
        <span style={{ color: after - before < 0 ? "#f87171" : "#4ade80" }}>
          Δ {(after - before).toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function JobCard({ job, scenes, onDelete }: { job: Job; scenes: Scene[]; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const before = scenes.find((s) => s.id === job.scene_before_id);
  const after = scenes.find((s) => s.id === job.scene_after_id);
  const r = job.result;

  const chartData = r
    ? [
        { name: "Veg Loss", value: r.vegetation_loss_pct, key: "vegetation_loss" },
        { name: "Veg Gain", value: r.vegetation_gain_pct, key: "vegetation_gain" },
        { name: "Water", value: r.water_change_pct, key: "water_change" },
        { name: "Urban", value: r.urban_expansion_pct, key: "urban_expansion" },
        { name: "Bare Soil", value: r.bare_soil_pct, key: "bare_soil" },
      ]
    : [];

  return (
    <div style={{ ...CARD, marginBottom: "0.75rem" }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}
        onClick={() => setExpanded((x) => !x)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Job #{job.id}</span>
            <StatusBadge status={job.status} />
            {r && <SeverityBadge severity={r.severity} />}
            {r && (
              <span style={{ fontSize: "0.875rem", color: "#7eb8ff", fontWeight: 700 }}>
                {r.change_pct.toFixed(1)}% change
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#4a6080", marginTop: 4 }}>
            {before?.name ?? `Scene ${job.scene_before_id}`} → {after?.name ?? `Scene ${job.scene_after_id}`}
            {" "}· {new Date(job.created_at).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
            style={{ fontSize: "0.78rem", color: "#f87171", padding: "0.25rem 0.5rem", background: "rgba(239,68,68,0.08)", borderRadius: 4, border: "none" }}
          >
            Delete
          </button>
          <span style={{ color: "#4a6080", fontSize: "0.8rem" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && r && (
        <div style={{ borderTop: "1px solid #1a2540", marginTop: "1rem", paddingTop: "1rem" }}>
          {/* Summary */}
          <div style={{
            background: "rgba(126,184,255,0.05)",
            border: "1px solid rgba(126,184,255,0.1)",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            color: "#94a3b8",
            lineHeight: 1.6,
            marginBottom: "1rem",
          }}>
            {r.summary}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Change breakdown bar chart */}
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                Change Breakdown (% of AOI)
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "#6a85a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6a85a8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#0d1626", border: "1px solid #1a2540", borderRadius: 6, fontSize: 12 }}
                    formatter={(v) => [`${Number(v).toFixed(2)}%`]}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={CHANGE_COLORS[entry.key as keyof typeof CHANGE_COLORS] ?? "#7eb8ff"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stats + NDVI */}
            <div>
              <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                Summary Stats
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.5rem" }}>
                {[
                  { label: "Total Change", value: `${r.change_pct.toFixed(1)}%`, accent: "#7eb8ff" },
                  { label: "Severity", value: r.severity.toUpperCase(), accent: { low: "#4ade80", medium: "#facc15", high: "#fb923c", critical: "#f87171" }[r.severity] },
                  { label: "Completed", value: job.completed_at ? new Date(job.completed_at).toLocaleTimeString() : "—", accent: "#94a3b8" },
                  { label: "NDVI Δ", value: r.ndvi_delta.toFixed(3), accent: r.ndvi_delta < 0 ? "#f87171" : "#4ade80" },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ background: "#080f1e", borderRadius: 6, padding: "0.5rem 0.75rem" }}>
                    <div style={{ fontSize: "0.65rem", color: "#3a5070", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: accent }}>{value}</div>
                  </div>
                ))}
              </div>
              <NdviGauge before={r.ndvi_before} after={r.ndvi_after} />
            </div>
          </div>
        </div>
      )}

      {expanded && job.status === "running" && (
        <div style={{ borderTop: "1px solid #1a2540", marginTop: "1rem", paddingTop: "1rem", color: "#60a5fa", fontSize: "0.875rem" }}>
          <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: "0.5rem" }}>⟳</span>
          Processing… refresh the page to see results.
        </div>
      )}
      {expanded && job.status === "failed" && (
        <div style={{ borderTop: "1px solid #1a2540", marginTop: "1rem", paddingTop: "1rem", color: "#f87171", fontSize: "0.875rem" }}>
          Error: {job.error_message}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const [aois, setAois] = useState<Aoi[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({ aoi_id: "", scene_before_id: "", scene_after_id: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterAoi, setFilterAoi] = useState<number | undefined>();

  const loadJobs = useCallback(() =>
    jobApi.list(filterAoi).then(setJobs).catch((e) => setError(e.message)), [filterAoi]);

  useEffect(() => {
    aoiApi.list().then(setAois).catch(() => {});
    sceneApi.list().then(setScenes).catch(() => {});
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Poll for running jobs
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;
    const t = setTimeout(() => loadJobs(), 3000);
    return () => clearTimeout(t);
  }, [jobs, loadJobs]);

  const aoiScenes = form.aoi_id
    ? scenes.filter((s) => s.aoi_id === parseInt(form.aoi_id))
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await jobApi.create({
        aoi_id: parseInt(form.aoi_id),
        scene_before_id: parseInt(form.scene_before_id),
        scene_after_id: parseInt(form.scene_after_id),
      });
      setForm((f) => ({ ...f, scene_before_id: "", scene_after_id: "" }));
      await loadJobs();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this job and its results?")) return;
    await jobApi.delete(id).catch((e) => setError(e.message));
    await loadJobs();
  };

  const filteredJobs = filterAoi ? jobs.filter((j) => j.aoi_id === filterAoi) : jobs;

  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#4a6080", margin: "0 0 0.25rem", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Processing
        </p>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Analysis Jobs</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#6a85a8", fontSize: "0.9rem" }}>
          Run change detection between two scenes and inspect results.
        </p>
      </div>

      {error && (
        <div style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "1.5rem" }}>
        {/* Jobs list */}
        <div>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setFilterAoi(undefined)}
              style={{ padding: "0.35rem 0.85rem", borderRadius: 6, border: "none", background: !filterAoi ? "#1e4a8a" : "#0d1626", color: !filterAoi ? "#c4d3e8" : "#6a85a8", fontSize: "0.8rem", cursor: "pointer" }}
            >
              All
            </button>
            {aois.map((a) => (
              <button
                key={a.id}
                onClick={() => setFilterAoi(a.id === filterAoi ? undefined : a.id)}
                style={{ padding: "0.35rem 0.85rem", borderRadius: 6, border: "none", background: filterAoi === a.id ? "#1e4a8a" : "#0d1626", color: filterAoi === a.id ? "#c4d3e8" : "#6a85a8", fontSize: "0.8rem", cursor: "pointer" }}
              >
                {a.name}
              </button>
            ))}
          </div>

          {filteredJobs.length === 0 ? (
            <div style={{ ...CARD, color: "#4a6080", fontSize: "0.875rem" }}>
              No jobs yet. Create one using the form.
            </div>
          ) : (
            filteredJobs.map((j) => (
              <JobCard key={j.id} job={j} scenes={scenes} onDelete={handleDelete} />
            ))
          )}
        </div>

        {/* Create job form */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
            New Analysis Job
          </div>

          {aois.length === 0 ? (
            <p style={{ color: "#4a6080", fontSize: "0.875rem" }}>
              Create an AOI and register at least 2 scenes first.
            </p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Area of Interest *</label>
                <select
                  required
                  value={form.aoi_id}
                  onChange={(e) => setForm((f) => ({ ...f, aoi_id: e.target.value, scene_before_id: "", scene_after_id: "" }))}
                >
                  <option value="">Select AOI…</option>
                  {aois.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Before Scene *</label>
                <select
                  required
                  value={form.scene_before_id}
                  onChange={(e) => setForm((f) => ({ ...f, scene_before_id: e.target.value }))}
                  disabled={!form.aoi_id}
                >
                  <option value="">Select scene…</option>
                  {aoiScenes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.acquired_at})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>After Scene *</label>
                <select
                  required
                  value={form.scene_after_id}
                  onChange={(e) => setForm((f) => ({ ...f, scene_after_id: e.target.value }))}
                  disabled={!form.aoi_id}
                >
                  <option value="">Select scene…</option>
                  {aoiScenes
                    .filter((s) => String(s.id) !== form.scene_before_id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.acquired_at})</option>
                    ))}
                </select>
              </div>

              <div style={{
                background: "rgba(126,184,255,0.04)",
                border: "1px solid rgba(126,184,255,0.08)",
                borderRadius: 6,
                padding: "0.75rem",
                fontSize: "0.78rem",
                color: "#6a85a8",
                lineHeight: 1.5,
              }}>
                The engine will compare spectral signatures between the two scenes and produce change type breakdown, NDVI delta, and a severity rating.
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "0.6rem 1.25rem",
                  background: saving ? "#1e3050" : "#1e4a8a",
                  color: "#c4d3e8",
                  border: "none",
                  borderRadius: 6,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                {saving ? "Submitting…" : "▶ Run Analysis"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
