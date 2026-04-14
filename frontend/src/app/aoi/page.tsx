"use client";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { aoiApi, type Aoi } from "@/lib/api";

const AoiMap = dynamic(() => import("@/components/AoiMap"), { ssr: false });

const CARD: React.CSSProperties = {
  background: "#0d1626",
  border: "1px solid #1a2540",
  borderRadius: 10,
  padding: "1.25rem 1.5rem",
};

const SATELLITES = ["Sentinel-2", "Landsat-8", "Landsat-9", "MODIS", "Planet"];

const defaultForm = {
  name: "",
  description: "",
  bbox_min_lat: "",
  bbox_max_lat: "",
  bbox_min_lon: "",
  bbox_max_lon: "",
};

export default function AoiPage() {
  const [aois, setAois] = useState<Aoi[]>([]);
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = () => aoiApi.list().then(setAois).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await aoiApi.create({
        name: form.name,
        description: form.description || null,
        bbox_min_lat: parseFloat(form.bbox_min_lat),
        bbox_max_lat: parseFloat(form.bbox_max_lat),
        bbox_min_lon: parseFloat(form.bbox_min_lon),
        bbox_max_lon: parseFloat(form.bbox_max_lon),
      });
      setForm(defaultForm);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this AOI and all its scenes and jobs?")) return;
    setDeleting(id);
    await aoiApi.delete(id).catch((e) => setError(e.message));
    setDeleting(null);
    await load();
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#4a6080", margin: "0 0 0.25rem", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Monitoring
        </p>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Areas of Interest</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#6a85a8", fontSize: "0.9rem" }}>
          Define geographic bounding boxes to monitor with satellite imagery.
        </p>
      </div>

      {error && (
        <div style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem" }}>
        {/* Left: map + list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Map */}
          <div style={{ ...CARD, padding: 0, overflow: "hidden", height: 340 }}>
            <AoiMap aois={aois} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          {/* AOI list */}
          <div style={CARD}>
            <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              {aois.length} Area{aois.length !== 1 ? "s" : ""} of Interest
            </div>
            {aois.length === 0 ? (
              <p style={{ color: "#4a6080", fontSize: "0.875rem" }}>No AOIs yet. Create one →</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {aois.map((aoi) => (
                  <div
                    key={aoi.id}
                    onClick={() => setSelectedId(aoi.id === selectedId ? undefined : aoi.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      border: `1px solid ${selectedId === aoi.id ? "#3b6fb5" : "#1a2540"}`,
                      background: selectedId === aoi.id ? "rgba(59,111,181,0.08)" : "#080f1e",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{aoi.name}</div>
                      {aoi.description && (
                        <div style={{ fontSize: "0.78rem", color: "#6a85a8", marginTop: 2 }}>{aoi.description}</div>
                      )}
                      <div style={{ fontSize: "0.72rem", color: "#3a5070", marginTop: 4, fontFamily: "monospace" }}>
                        [{aoi.bbox_min_lat.toFixed(2)}, {aoi.bbox_min_lon.toFixed(2)}] →
                        [{aoi.bbox_max_lat.toFixed(2)}, {aoi.bbox_max_lon.toFixed(2)}]
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", marginTop: 6 }}>
                        <span style={{ fontSize: "0.72rem", color: "#4a8a6a" }}>⊞ {aoi.scene_count} scenes</span>
                        <span style={{ fontSize: "0.72rem", color: "#4a6a8a" }}>⟳ {aoi.job_count} jobs</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <Link
                        href={`/scenes?aoi_id=${aoi.id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ fontSize: "0.78rem", color: "#7eb8ff", padding: "0.25rem 0.5rem", background: "rgba(126,184,255,0.08)", borderRadius: 4 }}
                      >
                        Scenes
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(aoi.id); }}
                        disabled={deleting === aoi.id}
                        style={{ fontSize: "0.78rem", color: "#f87171", padding: "0.25rem 0.5rem", background: "rgba(239,68,68,0.08)", borderRadius: 4, border: "none" }}
                      >
                        {deleting === aoi.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: create form */}
        <div ref={formRef}>
          <div style={CARD}>
            <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
              New Area of Interest
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Amazon Basin — Block 4"
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional notes…"
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ borderTop: "1px solid #1a2540", paddingTop: "0.9rem" }}>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.6rem" }}>
                  Bounding Box (decimal degrees)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  {[
                    { key: "bbox_min_lat", label: "Min Lat", placeholder: "-5.0" },
                    { key: "bbox_max_lat", label: "Max Lat", placeholder: "5.0" },
                    { key: "bbox_min_lon", label: "Min Lon", placeholder: "-70.0" },
                    { key: "bbox_max_lon", label: "Max Lon", placeholder: "-60.0" },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label style={{ fontSize: "0.72rem", color: "#6a85a8", display: "block", marginBottom: 3 }}>{label} *</label>
                      <input
                        required
                        type="number"
                        step="any"
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  marginTop: "0.25rem",
                  padding: "0.6rem 1.25rem",
                  background: saving ? "#1e3050" : "#1e4a8a",
                  color: "#c4d3e8",
                  border: "none",
                  borderRadius: 6,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  transition: "background 0.15s",
                }}
              >
                {saving ? "Creating…" : "Create AOI"}
              </button>
            </form>
          </div>

          {/* Example presets */}
          <div style={{ ...CARD, marginTop: "1rem" }}>
            <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Quick Presets
            </div>
            {[
              { name: "Amazon Basin", bbox_min_lat: -10, bbox_max_lat: 5, bbox_min_lon: -75, bbox_max_lon: -50, description: "Tropical deforestation monitoring" },
              { name: "Siberian Taiga", bbox_min_lat: 55, bbox_max_lat: 70, bbox_min_lon: 80, bbox_max_lon: 120, description: "Boreal forest fire tracking" },
              { name: "Aral Sea Region", bbox_min_lat: 42, bbox_max_lat: 48, bbox_min_lon: 57, bbox_max_lon: 62, description: "Water body change detection" },
            ].map((p) => (
              <button
                key={p.name}
                onClick={() =>
                  setForm({
                    name: p.name,
                    description: p.description,
                    bbox_min_lat: String(p.bbox_min_lat),
                    bbox_max_lat: String(p.bbox_max_lat),
                    bbox_min_lon: String(p.bbox_min_lon),
                    bbox_max_lon: String(p.bbox_max_lon),
                  })
                }
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "transparent",
                  border: "1px solid #1a2540",
                  borderRadius: 6,
                  color: "#94a3b8",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8rem",
                  marginBottom: "0.4rem",
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ color: "#7eb8ff", fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: "#4a6080", marginLeft: "0.5rem" }}>— {p.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
