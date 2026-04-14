const COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  pending:   { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", dot: "#64748b" },
  running:   { bg: "rgba(59,130,246,0.1)",  color: "#60a5fa", dot: "#3b82f6" },
  completed: { bg: "rgba(34,197,94,0.1)",   color: "#4ade80", dot: "#22c55e" },
  failed:    { bg: "rgba(239,68,68,0.1)",   color: "#f87171", dot: "#ef4444" },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = COLORS[status] ?? COLORS.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.15rem 0.55rem",
        borderRadius: 4,
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        background: c.bg,
        color: c.color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c.dot,
          display: "inline-block",
          animation: status === "running" ? "pulse 1.5s infinite" : "none",
        }}
      />
      {status}
    </span>
  );
}
