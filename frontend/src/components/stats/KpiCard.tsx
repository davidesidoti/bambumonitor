interface Props {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
}

export function KpiCard({ label, value, sub, delta, deltaPositive }: Props) {
  return (
    <div className="card flex flex-col gap-2 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)]">
      <div className="label">{label}</div>
      <div className="num-xl">{value}</div>
      {delta && (
        <div
          className="mono text-xs"
          style={{ color: deltaPositive ? "var(--ok)" : "var(--err)" }}
        >
          {deltaPositive ? "↑" : "↓"} {delta}
        </div>
      )}
      {sub && <div className="text-xs text-fg-3">{sub}</div>}
    </div>
  );
}
