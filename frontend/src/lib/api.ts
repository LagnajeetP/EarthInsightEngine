const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Aoi {
  id: number;
  name: string;
  description: string | null;
  bbox_min_lat: number;
  bbox_max_lat: number;
  bbox_min_lon: number;
  bbox_max_lon: number;
  created_at: string;
  scene_count: number;
  job_count: number;
}

export interface Scene {
  id: number;
  aoi_id: number;
  name: string;
  acquired_at: string;
  satellite: string;
  cloud_cover_pct: number;
  file_path: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface ChangeResult {
  id: number;
  job_id: number;
  change_pct: number;
  vegetation_loss_pct: number;
  vegetation_gain_pct: number;
  water_change_pct: number;
  urban_expansion_pct: number;
  bare_soil_pct: number;
  ndvi_before: number;
  ndvi_after: number;
  ndvi_delta: number;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface Job {
  id: number;
  aoi_id: number;
  scene_before_id: number;
  scene_after_id: number;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  result: ChangeResult | null;
}

export interface Stats {
  total_aois: number;
  total_scenes: number;
  total_jobs: number;
  completed_jobs: number;
  pending_jobs: number;
  failed_jobs: number;
  avg_change_pct: number | null;
  high_severity_count: number;
  recent_jobs: Job[];
}

// ── AOI ────────────────────────────────────────────────────────────────────

export const aoiApi = {
  list: () => request<Aoi[]>("/aoi"),
  get: (id: number) => request<Aoi>(`/aoi/${id}`),
  create: (body: Omit<Aoi, "id" | "created_at" | "scene_count" | "job_count">) =>
    request<Aoi>("/aoi", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: number) => request<void>(`/aoi/${id}`, { method: "DELETE" }),
};

// ── Scenes ─────────────────────────────────────────────────────────────────

export const sceneApi = {
  list: (aoi_id?: number) =>
    request<Scene[]>(`/scenes${aoi_id !== undefined ? `?aoi_id=${aoi_id}` : ""}`),
  get: (id: number) => request<Scene>(`/scenes/${id}`),
  create: (body: {
    aoi_id: number;
    name: string;
    acquired_at: string;
    satellite: string;
    cloud_cover_pct: number;
  }) => request<Scene>("/scenes", { method: "POST", body: JSON.stringify(body) }),
  upload: (form: FormData) =>
    fetch(`${BASE}/scenes/upload`, { method: "POST", body: form }).then((r) => {
      if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
      return r.json() as Promise<Scene>;
    }),
  delete: (id: number) => request<void>(`/scenes/${id}`, { method: "DELETE" }),
};

// ── Jobs ───────────────────────────────────────────────────────────────────

export const jobApi = {
  list: (aoi_id?: number) =>
    request<Job[]>(`/jobs${aoi_id !== undefined ? `?aoi_id=${aoi_id}` : ""}`),
  get: (id: number) => request<Job>(`/jobs/${id}`),
  create: (body: { aoi_id: number; scene_before_id: number; scene_after_id: number }) =>
    request<Job>("/jobs", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: number) => request<void>(`/jobs/${id}`, { method: "DELETE" }),
};

// ── Stats ──────────────────────────────────────────────────────────────────

export const statsApi = {
  get: () => request<Stats>("/stats"),
};
