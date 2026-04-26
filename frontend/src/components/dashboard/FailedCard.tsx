import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { PrinterState } from "@/types/api";

export function FailedCard({ state }: { state: PrinterState }) {
  return (
    <div
      className="card flex flex-col gap-3 rounded-[var(--card-r)] bg-bg-1 p-[var(--pad-lg)] shadow-[var(--shadow)]"
      style={{
        border: "1px solid color-mix(in oklch, var(--err) 30%, var(--line))",
      }}
    >
      <div className="flex items-center justify-between">
        <StatusBadge state={state.gcode_state} size="lg" />
      </div>
      <div className="text-sm text-fg-2">{state.file_name ?? "—"}</div>
      <div
        className="rounded-md p-3 text-[13px] leading-snug"
        style={{ background: "var(--err-soft)" }}
      >
        <div
          className="mb-1 font-semibold"
          style={{ color: "var(--err)" }}
        >
          Stampa fallita al layer {state.layer_num}
        </div>
        <div className="text-fg-2">
          La stampa è stata interrotta. Controlla il piatto e i log MQTT per
          ulteriori dettagli prima di rilanciare.
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Riprova</Button>
        <Button size="sm" variant="outline">
          Vedi dettagli
        </Button>
      </div>
    </div>
  );
}
