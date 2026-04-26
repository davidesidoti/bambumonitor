import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatETA, formatMinutes } from "@/lib/format";
import type { PrinterState } from "@/types/api";

function elapsedMinutes(state: PrinterState): number | null {
  if (!state.started_at) return null;
  const ms = Date.now() - new Date(state.started_at).getTime();
  return Math.max(0, Math.floor(ms / 60_000));
}

export function RunningCard({ state }: { state: PrinterState }) {
  const elapsed = elapsedMinutes(state);
  const total =
    elapsed != null ? elapsed + state.remaining_minutes : null;
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
        <KpiCell label="Trascorso" value={formatMinutes(elapsed)} />
        <KpiCell label="Totale" value={formatMinutes(total)} />
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

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="label">{label}</div>
      <div className="num-md">{value}</div>
    </div>
  );
}
