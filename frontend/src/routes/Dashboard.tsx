import { useLivePrinterState } from "@/hooks/useLivePrinterState";
import { usePrinterStore } from "@/store/printerStore";
import { WebcamPanel } from "@/components/dashboard/WebcamPanel";
import { KpiTile } from "@/components/dashboard/KpiTile";
import { RunningCard } from "@/components/dashboard/RunningCard";
import { IdleCard } from "@/components/dashboard/IdleCard";
import { FailedCard } from "@/components/dashboard/FailedCard";
import { TempCard } from "@/components/dashboard/TempCard";
import { FilamentTile } from "@/components/dashboard/FilamentTile";
import { SpeedTile } from "@/components/dashboard/SpeedTile";
import { ChamberLightTile } from "@/components/dashboard/ChamberLightTile";
import { useFilament } from "@/hooks/useFilament";

export default function Dashboard() {
  useLivePrinterState();
  const state = usePrinterStore((s) => s.state);
  const hasSnapshot = usePrinterStore((s) => s.hasSnapshot);
  const { data: filamentFallback } = useFilament();

  const status = state.gcode_state;
  const isRunning = status === "RUNNING" || status === "PAUSE";
  const isFailed = status === "FAILED";
  const isIdle = !isRunning && !isFailed;

  return (
    <div className="flex flex-col gap-[var(--gap)]">
      <div className="grid items-start gap-[var(--gap)] lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-[var(--gap)]">
          <WebcamPanel state={state} />
          <div className="flex flex-wrap gap-3">
            <SpeedTile current={state.print_speed} />
            <ChamberLightTile current={state.chamber_light} />
            <KpiTile
              label="Ventola"
              value={`${state.fan_speed}%`}
              hint="parte raffr."
              mono
            />
            <FilamentTile
              live={{
                type: state.filament_type,
                color: state.filament_color,
              }}
              fallback={filamentFallback}
            />
          </div>
        </div>
        <div className="flex w-full flex-col gap-[var(--gap)]">
          {!hasSnapshot ? (
            <div className="card rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)] text-sm text-fg-3">
              In attesa dello snapshot dal printer...
            </div>
          ) : isFailed ? (
            <FailedCard state={state} />
          ) : isIdle ? (
            <IdleCard state={state} />
          ) : (
            <RunningCard state={state} />
          )}
          <TempCard state={state} />
        </div>
      </div>
    </div>
  );
}
