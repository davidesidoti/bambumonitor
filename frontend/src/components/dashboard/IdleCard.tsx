import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { PrinterState } from "@/types/api";

export function IdleCard({ state }: { state: PrinterState }) {
  return (
    <div className="card flex flex-col items-start gap-3 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)] shadow-[var(--shadow)]">
      <StatusBadge state={state.gcode_state} size="lg" />
      <div className="text-[18px] font-medium tracking-tight text-fg-2">
        Stampante in attesa
      </div>
      <p className="max-w-[360px] text-sm text-fg-3">
        Nessun lavoro in corso. Le temperature sono a riposo, pronte al
        prossimo invio dal slicer.
      </p>
      <div className="mt-1 flex w-full gap-3">
        <Tile label="Nozzle" value={`${state.nozzle_temp.toFixed(0)}°C`} />
        <Tile label="Piatto" value={`${state.bed_temp.toFixed(0)}°C`} />
        <Tile label="Aggiornato" value={"adesso"} />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="label">{label}</div>
      <div className="num-md">{value}</div>
    </div>
  );
}
