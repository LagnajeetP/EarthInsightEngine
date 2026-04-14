const COLORS: Record<string, { bg: string; color: string }> = {
  low:      { bg: "rgba(34,197,94,0.15)",  color: "#4ade80" },
  medium:   { bg: "rgba(234,179,8,0.15)",  color: "#facc15" },
  high:     { bg: "rgba(249,115,22,0.15)", color: "#fb923c" },
  critical: { bg: "rgba(239,68,68,0.15)",  color: "#f87171" },
};

export default function SeverityBadge({ severity }: { severity: string }) {
  const c = COLORS[severity] ?? COLORS.low;
  return (
    <span
      style={{
        display: "inline-block",
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
      {severity}
    </span>
  );
}
