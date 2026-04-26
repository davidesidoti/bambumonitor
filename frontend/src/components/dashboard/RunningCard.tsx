import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatETA, formatMinutes } from "@/lib/format";
import type { PrinterState } from "@/types/api";

interface Timing {
  elapsed: number | null;
  total: number | null;
  /** True when we estimated from percent because started_at is missing. */
  estimated: boolean;
}

function timing(state: PrinterState): Timing {
  // Preferred path: the printer reported gcode_start_time → exact wall-clock.
  if (state.started_at) {
    const elapsed = Math.max(
      0,
      Math.floor((Date.now() - new Date(state.started_at).getTime()) / 60_000),
    );
    return {
      elapsed,
      total: elapsed + state.remaining_minutes,
      estimated: false,
    };
  }
  // Fallback: estimate from percent + remaining_minutes.
  // total = remaining / (1 - percent/100)
  // The estimate becomes unreliable near 0% and 100%, so we bail there.
  if (state.percent <= 1 || state.percent >= 99) {
    return { elapsed: null, total: null, estimated: false };
  }
  const total = Math.round(state.remaining_minutes / (1 - state.percent / 100));
  const elapsed = Math.max(0, total - state.remaining_minutes);
  return { elapsed, total, estimated: true };
}

export function RunningCard({ state }: { state: PrinterState }) {
  const t = timing(state);
  const elapsed = t.elapsed;
  const total = t.total;
  const layerPct =
    state.total_layer_num > 0
      ? (state.layer_num / state.total_layer_num) * 100
      : 0;
  return (
    <div className="card flex flex-col gap-[18px] rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between">
        <StatusBadge state={state.gcode_state} size="lg" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm text-fg-2">{state.file_name ?? "—"}</div>
        <div className="flex items-baseline gap-2">
          <div className="num-xl">
            {state.percent.toFixed(1)}
            <span style={{ fontSize: "0.5em", color: "var(--fg-3)" }}>%</span>
          </div>
          <div className="ml-auto mono text-sm text-fg-3">
            ETA{" "}
            <span className="font-semibold" style={{ color: "var(--fg)" }}>
              {formatETA(state.remaining_minutes)}
            </span>
          </div>
        </div>
        <div className="progress thick mt-2">
          <div className="fill" style={{ width: `${state.percent}%` }} />
        </div>
      </div>
      <div className="flex gap-3">
        <KpiCell label="Mancante" value={formatMinutes(state.remaining_minutes)} />
        <KpiCell
          label="Trascorso"
          value={formatMinutes(elapsed)}
          estimated={t.estimated}
        />
        <KpiCell
          label="Totale"
          value={formatMinutes(total)}
          estimated={t.estimated}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs">
          <span className="label">Layer</span>
          <span className="mono">
            <span className="font-semibold">{state.layer_num}</span>{" "}
            <span className="text-fg-3">/ {state.total_layer_num}</span>
          </span>
        </div>
        <div className="progress thin">
          <div
            className="fill"
            style={{ width: `${layerPct}%`, background: "var(--fg-2)" }}
          />
        </div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  estimated,
}: {
  label: string;
  value: string;
  estimated?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="label">{label}</div>
      <div
        className="num-md"
        title={estimated ? "Stimato da % avanzamento" : undefined}
      >
        {value}
        {estimated && value !== "—" && (
          <span className="ml-1 text-xs text-fg-3">~</span>
        )}
      </div>
    </div>
  );
}
