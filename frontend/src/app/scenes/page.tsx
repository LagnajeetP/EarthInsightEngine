"use client";
import { useEffect, useRef, useState, Suspense } from "react";
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
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [filterAoi, setFilterAoi] = useState<number | undefined>(filterAoiId);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setUploadProgress(null);
    try {
      if (file) {
        // Upload GeoTIFF with metadata
        setUploadProgress("Uploading GeoTIFF…");
        const fd = new FormData();
        fd.append("aoi_id", form.aoi_id);
        fd.append("name", form.name);
        fd.append("acquired_at", form.acquired_at);
        fd.append("satellite", form.satellite);
        fd.append("cloud_cover_pct", form.cloud_cover_pct);
        fd.append("file", file);
        await sceneApi.upload(fd);
        setUploadProgress(null);
      } else {
        // Metadata-only registration
        await sceneApi.create({
          aoi_id: parseInt(form.aoi_id),
          name: form.name,
          acquired_at: form.acquired_at,
          satellite: form.satellite,
          cloud_cover_pct: parseFloat(form.cloud_cover_pct),
        });
      }
      setForm({ ...defaultForm, aoi_id: form.aoi_id });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadScenes();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setUploadProgress(null);
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

  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#4a6080", margin: "0 0 0.25rem", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Imagery
        </p>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          Scenes
          {filterAoi && (
            <span style={{ fontSize: "1rem", color: "#6a85a8", fontWeight: 400, marginLeft: "0.75rem" }}>
              — {aois.find((a) => a.id === filterAoi)?.name}
            </span>
          )}
        </h1>
        <p style={{ margin: "0.5rem 0 0", color: "#6a85a8", fontSize: "0.9rem" }}>
          Upload GeoTIFF scenes (before &amp; after) to run real NDVI change detection.
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
            padding: "0.35rem 0.85rem", borderRadius: 6, border: "none",
            background: filterAoi === undefined ? "#1e4a8a" : "#0d1626",
            color: filterAoi === undefined ? "#c4d3e8" : "#6a85a8",
            fontSize: "0.8rem", cursor: "pointer",
          }}
        >
          All AOIs
        </button>
        {aois.map((a) => (
          <button
            key={a.id}
            onClick={() => setFilterAoi(a.id)}
            style={{
              padding: "0.35rem 0.85rem", borderRadius: 6, border: "none",
              background: filterAoi === a.id ? "#1e4a8a" : "#0d1626",
              color: filterAoi === a.id ? "#c4d3e8" : "#6a85a8",
              fontSize: "0.8rem", cursor: "pointer",
            }}
          >
            {a.name}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "1.5rem" }}>
        {/* Scene list */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
            {scenes.length} Scene{scenes.length !== 1 ? "s" : ""}
          </div>
          {scenes.length === 0 ? (
            <p style={{ color: "#4a6080", fontSize: "0.875rem" }}>
              No scenes yet. Upload a GeoTIFF using the form.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {scenes.map((s) => {
                const aoiName = aois.find((a) => a.id === s.aoi_id)?.name ?? `AOI ${s.aoi_id}`;
                const hasFile = !!s.file_path;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      padding: "0.75rem 1rem", borderRadius: 8,
                      border: `1px solid ${hasFile ? "#1a3a5c" : "#2a1a1a"}`,
                      background: hasFile ? "#080f1e" : "#100808",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.name}</span>
                        {hasFile ? (
                          <span style={{ fontSize: "0.65rem", background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4, padding: "1px 5px" }}>
                            GeoTIFF
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.65rem", background: "rgba(234,179,8,0.12)", color: "#facc15", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 4, padding: "1px 5px" }}>
                            no file
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#6a85a8", marginTop: 2 }}>
                        {s.satellite} · {s.acquired_at} · ☁ {s.cloud_cover_pct.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#3a5070", marginTop: 3 }}>
                        {aoiName}
                        {s.file_size_bytes != null && (
                          <span style={{ marginLeft: "0.5rem" }}>
                            · {(s.file_size_bytes / 1024 / 1024).toFixed(2)} MB
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

        {/* Upload / register form */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
            Upload Scene
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
                  type="number" min={0} max={100} step={0.1}
                  value={form.cloud_cover_pct}
                  onChange={(e) => setForm((f) => ({ ...f, cloud_cover_pct: e.target.value }))}
                />
              </div>
            </div>

            {/* GeoTIFF file upload */}
            <div>
              <label style={{ fontSize: "0.78rem", color: "#94a3b8", display: "block", marginBottom: 4 }}>
                GeoTIFF File <span style={{ color: "#4a6080" }}>(required for real analysis)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".tif,.tiff,.geotiff"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{
                  width: "100%", padding: "0.4rem 0.6rem",
                  background: "#060d1a", border: "1px solid #1a2540",
                  borderRadius: 6, color: "#94a3b8", fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              />
              {file && (
                <div style={{ fontSize: "0.72rem", color: "#4ade80", marginTop: 4 }}>
                  {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>

            {uploadProgress && (
              <div style={{ fontSize: "0.78rem", color: "#60a5fa", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, padding: "0.4rem 0.7rem" }}>
                {uploadProgress}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "0.6rem 1.25rem",
                background: saving ? "#1e3050" : "#1e4a8a",
                color: "#c4d3e8", border: "none", borderRadius: 6,
                fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? (uploadProgress ?? "Saving…") : (file ? "Upload & Register Scene" : "Register Scene (metadata only)")}
            </button>
          </form>

          <div style={{ borderTop: "1px solid #1a2540", marginTop: "1.25rem", paddingTop: "1rem", fontSize: "0.72rem", color: "#4a6080", lineHeight: 1.6 }}>
            <strong style={{ color: "#6a85a8" }}>Supported formats:</strong> 1-band (NDVI), 2-band (NIR/Red),
            or 4-band Sentinel-2 10 m clip (B2/B3/B4/B8 order). Run analysis requires a GeoTIFF on both the
            before and after scenes.
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
