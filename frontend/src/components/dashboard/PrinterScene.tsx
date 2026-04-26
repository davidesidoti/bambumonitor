import { cn } from "@/lib/cn";
import type { GcodeState } from "@/types/api";

export function PrinterScene({
  state,
  percent,
}: {
  state: GcodeState;
  percent: number;
}) {
  const cls =
    state === "IDLE" || state === "FINISH"
      ? "idle"
      : state === "PAUSE" || state === "FAILED"
        ? "paused"
        : "";
  const objHeight =
    state === "IDLE" || state === "PREPARE"
      ? 4
      : state === "FAILED"
        ? Math.max(4, 22 * 0.18)
        : Math.max(4, 22 * (percent / 100));

  return (
    <div className="webcam-stage bg-grid">
      <div className={cn("printer", cls)}>
        <div className="build-plate" />
        <div className="plate-grid" />
        <div className="object" style={{ height: `${objHeight}%` }} />
        <div className="gantry">
          <div className="toolhead" />
        </div>
      </div>
    </div>
  );
}
