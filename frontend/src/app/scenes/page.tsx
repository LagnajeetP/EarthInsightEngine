"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { aoiApi, sceneApi, type Aoi, type Scene } from "@/lib/api";

const CARD: React.CSSProperties = {
  background: "#0d1626",
  border: "1px solid #1a2540",
  borderRadius: 10,
  padding: "1.25rem 1.5rem",
};

const SATELLITES = ["Sentinel-2", "Landsat-8", "Landsat-9", "MODIS", "Planet", "Other"];

const defaultForm = {
  aoi_id: "",
  name: "",
  acquired_at: "",
  satellite: "Sentinel-2",
  cloud_cover_pct: "0",
};

function ScenesInner() {
  const searchParams = useSearchParams();
  const filterAoiId = searchParams.get("aoi_id") ? Number(searchParams.get("aoi_id")) : undefined;

  const [aois, setAois] = useState<Aoi[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [form, setForm] = useState({ ...defaultForm, aoi_id: filterAoiId ? String(filterAoiId) : "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filterAoi, setFilterAoi] = useState<number | undefined>(filterAoiId);

  const loadScenes = () => sceneApi.list(filterAoi).then(setScenes).catch((e) => setError(e.message));

  useEffect(() => {
    aoiApi.list().then(setAois).catch(() => {});
  }, []);

  useEffect(() => {
    loadScenes();
  }, [filterAoi]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await sceneApi.create({
        aoi_id: parseInt(form.aoi_id),
        name: form.name,
        acquired_at: form.acquired_at,
        satellite: form.satellite,
        cloud_cover_pct: parseFloat(form.cloud_cover_pct),
      });
      setForm({ ...defaultForm, aoi_id: form.aoi_id });
      await loadScenes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this scene?")) return;
    setDeleting(id);
    await sceneApi.delete(id).catch((e) => setError(e.message));
    setDeleting(null);
    await loadScenes();
  };

  const aoisByFilter = filterAoi ? aois.filter((a) => a.id === filterAoi) : aois;
  const filterAoiName = filterAoi ? aois.find((a) => a.id === filterAoi)?.name : undefined;

  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#4a6080", margin: "0 0 0.25rem", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Imagery
        </p>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          Scenes
          {filterAoiName && (
            <span style={{ fontSize: "1rem", color: "#6a85a8", fontWeight: 400, marginLeft: "0.75rem" }}>
              — {filterAoiName}
            </span>
          )}
        </h1>
        <p style={{ margin: "0.5rem 0 0", color: "#6a85a8", fontSize: "0.9rem" }}>
          Register satellite acquisitions (with optional file upload) for change detection.
        </p>
      </div>

      {error && (
        <div style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {/* AOI filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setFilterAoi(undefined)}
          style={{
            padding: "0.35rem 0.85rem",
            borderRadius: 6,
            border: "none",
            background: filterAoi === undefined ? "#1e4a8a" : "#0d1626",
            color: filterAoi === undefined ? "#c4d3e8" : "#6a85a8",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          All AOIs
        </button>
        {aois.map((a) => (
          <button
            key={a.id}
            onClick={() => setFilterAoi(a.id)}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: 6,
              border: "none",
              background: filterAoi === a.id ? "#1e4a8a" : "#0d1626",
              color: filterAoi === a.id ? "#c4d3e8" : "#6a85a8",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {a.name}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem" }}>
        {/* Scene list */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            {scenes.length} Scene{scenes.length !== 1 ? "s" : ""}
          </div>
          {scenes.length === 0 ? (
            <p style={{ color: "#4a6080", fontSize: "0.875rem" }}>
              No scenes yet. Register one using the form.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {scenes.map((s) => {
                const aoiName = aois.find((a) => a.id === s.aoi_id)?.name ?? `AOI ${s.aoi_id}`;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      border: "1px solid #1a2540",
                      background: "#080f1e",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#6a85a8", marginTop: 2 }}>
                        {s.satellite} · {s.acquired_at} · ☁ {s.cloud_cover_pct.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#3a5070", marginTop: 3 }}>
                        {aoiName}
                        {s.file_size_bytes && (
                          <span style={{ marginLeft: "0.5rem" }}>
                            · {(s.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deleting === s.id}
                      style={{ fontSize: "0.78rem", color: "#f87171", padding: "0.25rem 0.5rem", background: "rgba(239,68,68,0.08)", borderRadius: 4, border: "none", flexShrink: 0 }}
                    >
                      {deleting === s.id ? "…" : "Delete"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Register scene form */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
            Register Scene
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Area of Interest *</label>
              <select
                required
                value={form.aoi_id}
                onChange={(e) => setForm((f) => ({ ...f, aoi_id: e.target.value }))}
              >
                <option value="">Select AOI…</option>
                {aois.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Scene Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="S2_20240315_T23KPQ"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Acquisition Date *</label>
              <input
                required
                type="date"
                value={form.acquired_at}
                onChange={(e) => setForm((f) => ({ ...f, acquired_at: e.target.value }))}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Satellite</label>
                <select value={form.satellite} onChange={(e) => setForm((f) => ({ ...f, satellite: e.target.value }))}>
                  {SATELLITES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Cloud Cover %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.cloud_cover_pct}
                  onChange={(e) => setForm((f) => ({ ...f, cloud_cover_pct: e.target.value }))}
                />
              </div>
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
              {saving ? "Saving…" : "Register Scene"}
            </button>
          </form>

          <div style={{ borderTop: "1px solid #1a2540", marginTop: "1.25rem", paddingTop: "1rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#4a6080", marginBottom: "0.5rem" }}>
              TIP: Use &ldquo;Register Scene&rdquo; to add metadata only. Actual image files are optional for the change detection simulation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScenesPage() {
  return (
    <Suspense fallback={<div style={{ padding: "2rem", color: "#4a6080" }}>Loading…</div>}>
      <ScenesInner />
    </Suspense>
  );
}
