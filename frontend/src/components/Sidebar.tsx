"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "◈" },
  { href: "/aoi", label: "Areas of Interest", icon: "⬡" },
  { href: "/scenes", label: "Scenes", icon: "⊞" },
  { href: "/analysis", label: "Analysis Jobs", icon: "⟳" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#080f1e",
        borderRight: "1px solid #1a2540",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 0",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 1.25rem 1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.3rem" }}>🛰️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#e8edf7", lineHeight: 1.2 }}>
              Earth Insight
            </div>
            <div style={{ fontSize: "0.7rem", color: "#4a6080", letterSpacing: "0.08em" }}>
              CHANGE DETECTION
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.65rem 1.25rem",
                color: active ? "#7eb8ff" : "#6a85a8",
                background: active ? "rgba(126,184,255,0.07)" : "transparent",
                borderLeft: active ? "2px solid #7eb8ff" : "2px solid transparent",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "1rem", opacity: active ? 1 : 0.6 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #1a2540" }}>
        <div style={{ fontSize: "0.7rem", color: "#2e4060", lineHeight: 1.5 }}>
          <div>Sentinel-2 · Landsat</div>
          <div>v0.2.0 MVP</div>
        </div>
      </div>
    </aside>
  );
}
