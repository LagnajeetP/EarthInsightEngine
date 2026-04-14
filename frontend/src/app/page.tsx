"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { statsApi, type Stats, type Job } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import SeverityBadge from "@/components/SeverityBadge";

const CARD_STYLE: React.CSSProperties = {
  background: "#0d1626",
  border: "1px solid #1a2540",
  borderRadius: 10,
  padding: "1.25rem 1.5rem",
};

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div style={{ ...CARD_STYLE, flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color: accent ?? "#e8edf7", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.75rem", color: "#4a6080", marginTop: "0.3rem" }}>{sub}</div>}
    </div>
  );
}

function RecentJobRow({ job }: { job: Job }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "0.75rem 0",
        borderBottom: "1px solid #1a2540",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.875rem", color: "#c4d3e8" }}>
          Job #{job.id} — AOI {job.aoi_id}
        </div>
        <div style={{ fontSize: "0.72rem", color: "#4a6080", marginTop: 2 }}>
          {new Date(job.created_at).toLocaleString()}
        </div>
      </div>
      <StatusBadge status={job.status} />
      {job.result && <SeverityBadge severity={job.result.severity} />}
      {job.result && (
        <div style={{ fontSize: "0.875rem", color: "#7eb8ff", fontWeight: 600, minWidth: 60, textAlign: "right" }}>
          {job.result.change_pct.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statsApi.get().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "1rem 1.25rem" }}>
          <strong>Cannot reach API</strong> — {error}
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
            Make sure the backend is running: <code>uvicorn app.main:app --reload</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ color: "#4a6080", margin: "0 0 0.25rem", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Overview
        </p>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ margin: "0.5rem 0 0", color: "#6a85a8", fontSize: "0.9rem" }}>
          Monitor satellite change detection across all your areas of interest.
        </p>
      </div>

      {/* Stat cards */}
      {stats ? (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <StatCard label="Areas of Interest" value={stats.total_aois} sub="monitored regions" />
            <StatCard label="Scenes" value={stats.total_scenes} sub="uploaded images" />
            <StatCard label="Analysis Jobs" value={stats.total_jobs} sub={`${stats.completed_jobs} completed`} />
            <StatCard
              label="High/Critical"
              value={stats.high_severity_count}
              sub="severity alerts"
              accent={stats.high_severity_count > 0 ? "#fb923c" : "#4ade80"}
            />
            <StatCard
              label="Avg Change"
              value={stats.avg_change_pct !== null ? `${stats.avg_change_pct.toFixed(1)}%` : "—"}
              sub="across completed jobs"
              accent="#7eb8ff"
            />
          </div>

          {/* Job status summary */}
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            <div style={{ ...CARD_STYLE, flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                Job Status Breakdown
              </div>
              {[
                { label: "Completed", count: stats.completed_jobs, color: "#4ade80" },
                { label: "Running / Pending", count: stats.pending_jobs, color: "#60a5fa" },
                { label: "Failed", count: stats.failed_jobs, color: "#f87171" },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      height: 8,
                      flex: 1,
                      borderRadius: 4,
                      background: "#1a2540",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: stats.total_jobs ? `${(count / stats.total_jobs) * 100}%` : "0%",
                        background: color,
                        borderRadius: 4,
                        transition: "width 0.6s",
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#94a3b8", minWidth: 130 }}>
                    {label}: <span style={{ color, fontWeight: 600 }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ ...CARD_STYLE, flex: 2, minWidth: 300 }}>
              <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                Quick Actions
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {[
                  { href: "/aoi", label: "+ New Area of Interest", bg: "#1e3a5a" },
                  { href: "/scenes", label: "+ Upload Scene", bg: "#1a3a2a" },
                  { href: "/analysis", label: "▶ Run Analysis", bg: "#3a2a1a" },
                ].map(({ href, label, bg }) => (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: "inline-block",
                      padding: "0.5rem 1rem",
                      borderRadius: 6,
                      background: bg,
                      color: "#c4d3e8",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      border: "1px solid rgba(255,255,255,0.06)",
                      textDecoration: "none",
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Recent jobs */}
          <div style={CARD_STYLE}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#4a6080", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Recent Jobs
              </div>
              <Link href="/analysis" style={{ fontSize: "0.78rem" }}>
                View all →
              </Link>
            </div>
            {stats.recent_jobs.length === 0 ? (
              <p style={{ color: "#4a6080", fontSize: "0.875rem", margin: "1rem 0" }}>
                No jobs yet.{" "}
                <Link href="/analysis">Create your first analysis.</Link>
              </p>
            ) : (
              stats.recent_jobs.map((j) => <RecentJobRow key={j.id} job={j} />)
            )}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 10,
                background: "linear-gradient(90deg, #0d1626 25%, #111e35 50%, #0d1626 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
