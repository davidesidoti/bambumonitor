import { ThermoTile } from "@/components/dashboard/ThermoTile";
import { MiniTempChart } from "@/components/dashboard/MiniTempChart";
import type { PrinterState } from "@/types/api";

export function TempCard({ state }: { state: PrinterState }) {
  return (
    <div className="card flex flex-col gap-3 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)] shadow-[var(--shadow)]">
      <div className="flex gap-3">
        <ThermoTile
          label="Nozzle"
          temp={state.nozzle_temp}
          target={state.nozzle_target}
        />
        <ThermoTile
          label="Piatto"
          temp={state.bed_temp}
          target={state.bed_target}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="label">Ultimi 30 min</span>
        <div className="flex gap-3 text-xs text-fg-3">
          <Legend swatch="var(--nozzle)" label="Nozzle" />
          <Legend swatch="var(--bed)" label="Piatto" />
        </div>
      </div>
      <MiniTempChart
        nozzleTarget={state.nozzle_target}
        bedTarget={state.bed_target}
      />
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ width: 8, height: 2, background: swatch }} />
      {label}
    </span>
  );
}
